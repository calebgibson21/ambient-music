"""
FastAPI backend for Lyria ambient music streaming.

Provides REST endpoints to start/stop music sessions and 
Socket.IO for streaming audio to clients.
"""

import asyncio
import base64
import os
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from logging_config import log_info, log_warning, log_error, log_debug
from lyria_client import LyriaConfig, LyriaSession, LyriaSessionManager
from prompt_generator import generate_music_prompts, get_recommended_bpm

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is required")


# Session metrics dataclass for observability
@dataclass
class SessionMetrics:
    """Metrics for tracking session health and performance."""
    session_id: str
    start_time: datetime
    book_title: str
    chunks_sent: int = 0
    bytes_sent: int = 0
    chunks_received: int = 0
    bytes_received: int = 0
    chunks_dropped: int = 0
    max_queue_depth: int = 0
    connected_clients: int = 0


# Application start time for uptime tracking
app_start_time: Optional[datetime] = None

# Global session manager
session_manager: Optional[LyriaSessionManager] = None

# Audio queues for each session (to buffer chunks for Socket.IO clients)
audio_queues: dict[str, asyncio.Queue] = {}

# Session metrics for observability
session_metrics: dict[str, SessionMetrics] = {}

# Create Socket.IO server with ASGI mode
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Mapping of socket ID to session ID for cleanup
socket_sessions: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global session_manager, app_start_time
    app_start_time = datetime.now(timezone.utc)
    session_manager = LyriaSessionManager(GEMINI_API_KEY)
    log_info("server_started", api_key_configured=True)
    yield
    # Cleanup on shutdown
    log_info("server_stopping", active_sessions=len(session_metrics))
    await session_manager.close_all()


fastapi_app = FastAPI(
    title="Ambient Music API",
    description="Stream AI-generated ambient music based on book themes",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for React Native
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wrap FastAPI with Socket.IO ASGI app
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)


# Request/Response Models
class BookMetadata(BaseModel):
    """Book information for generating themed music."""
    title: str
    authors: Optional[list[str]] = None
    subjects: Optional[list[str]] = None
    description: Optional[str] = None


class StartMusicRequest(BaseModel):
    """Request to start a music session."""
    book: BookMetadata


class StartMusicResponse(BaseModel):
    """Response with session information."""
    session_id: str
    prompts: list[dict[str, float | str]]


class SessionStatusResponse(BaseModel):
    """Current session status."""
    session_id: str
    is_playing: bool
    prompts: list[dict[str, float | str]]


# Helper to broadcast audio to Socket.IO room
async def broadcast_audio_to_room(session_id: str) -> None:
    """
    Background task that reads from the audio queue and 
    broadcasts to all clients in the Socket.IO room.
    """
    log_info("broadcast_task_started", session_id=session_id)
    queue = audio_queues.get(session_id)
    metrics = session_metrics.get(session_id)
    if not queue:
        log_warning("broadcast_no_queue", session_id=session_id)
        return
    
    room_name = f"session_{session_id}"
    
    while True:
        try:
            queue_size = queue.qsize()
            log_debug("broadcast_waiting", session_id=session_id, queue_size=queue_size)
            
            # Track max queue depth
            if metrics and queue_size > metrics.max_queue_depth:
                metrics.max_queue_depth = queue_size
            
            audio_data = await asyncio.wait_for(queue.get(), timeout=1.0)
            chunk_size = len(audio_data)
            log_debug("broadcast_chunk_received", session_id=session_id, chunk_size=chunk_size)
            
            # Encode audio as base64 for transmission
            encoded = base64.b64encode(audio_data).decode('utf-8')
            
            # Emit to all clients in the session room
            await sio.emit("audio_chunk", {"data": encoded}, room=room_name)
            
            # Update metrics
            if metrics:
                metrics.chunks_sent += 1
                metrics.bytes_sent += chunk_size
            
            # Log every 50 chunks (~1 second of audio at typical chunk rates)
            if metrics and metrics.chunks_sent % 50 == 0:
                log_info(
                    "audio_streaming_progress",
                    session_id=session_id,
                    chunks_sent=metrics.chunks_sent,
                    bytes_sent=metrics.bytes_sent,
                    kb_sent=round(metrics.bytes_sent / 1024, 1),
                )
            
            queue.task_done()
        except asyncio.TimeoutError:
            # Check if session still exists
            if session_id not in audio_queues:
                break
        except asyncio.CancelledError:
            break
        except Exception as e:
            log_error("broadcast_error", session_id=session_id, error=str(e))
            break
    
    if metrics:
        log_info(
            "broadcast_ended",
            session_id=session_id,
            total_chunks=metrics.chunks_sent,
            total_kb=round(metrics.bytes_sent / 1024, 1),
        )
    else:
        log_info("broadcast_ended", session_id=session_id)


# Stored prompts per session for status endpoint
session_prompts: dict[str, list[dict]] = {}

# Broadcast tasks
broadcast_tasks: dict[str, asyncio.Task] = {}


# Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    log_info("socket_client_connected", socket_id=sid)


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    # Clean up session mapping
    session_id = socket_sessions.pop(sid, None)
    if session_id:
        room_name = f"session_{session_id}"
        await sio.leave_room(sid, room_name)
        # Update metrics
        metrics = session_metrics.get(session_id)
        if metrics and metrics.connected_clients > 0:
            metrics.connected_clients -= 1
        log_info("socket_client_disconnected", socket_id=sid, session_id=session_id)
    else:
        log_info("socket_client_disconnected", socket_id=sid)


@sio.event
async def join_session(sid, data):
    """
    Handle client joining a music session.
    
    Expected data: {"session_id": "uuid"}
    """
    session_id = data.get("session_id")
    log_info("socket_join_request", socket_id=sid, session_id=session_id)
    
    if not session_manager:
        log_warning("socket_join_failed", socket_id=sid, reason="service_not_initialized")
        await sio.emit("error", {"message": "Service not initialized"}, to=sid)
        return
    
    session = session_manager.get_session(session_id)
    if not session:
        log_warning("socket_join_failed", socket_id=sid, session_id=session_id, reason="session_not_found")
        await sio.emit("error", {"message": "Session not found"}, to=sid)
        return
    
    # Join the session room
    room_name = f"session_{session_id}"
    await sio.enter_room(sid, room_name)
    socket_sessions[sid] = session_id
    
    # Update metrics
    metrics = session_metrics.get(session_id)
    if metrics:
        metrics.connected_clients += 1
    
    log_info("socket_client_joined", socket_id=sid, session_id=session_id, room=room_name)
    
    # Send initial status
    await sio.emit("session_joined", {
        "session_id": session_id,
        "is_playing": session.is_playing,
        "sample_rate": 48000,
        "channels": 2,
        "format": "pcm16",
    }, to=sid)


@sio.event
async def leave_session(sid, data):
    """Handle client leaving a music session."""
    session_id = data.get("session_id")
    if session_id:
        room_name = f"session_{session_id}"
        await sio.leave_room(sid, room_name)
        socket_sessions.pop(sid, None)
        # Update metrics
        metrics = session_metrics.get(session_id)
        if metrics and metrics.connected_clients > 0:
            metrics.connected_clients -= 1
        log_info("socket_client_left", socket_id=sid, session_id=session_id)


@sio.event
async def pause(sid, data):
    """Handle pause command from client."""
    session_id = data.get("session_id")
    
    if not session_manager:
        log_warning("socket_pause_failed", socket_id=sid, reason="service_not_initialized")
        await sio.emit("error", {"message": "Service not initialized"}, to=sid)
        return
    
    session = session_manager.get_session(session_id)
    if not session:
        log_warning("socket_pause_failed", socket_id=sid, session_id=session_id, reason="session_not_found")
        await sio.emit("error", {"message": "Session not found"}, to=sid)
        return
    
    await session.pause()
    log_info("session_paused", session_id=session_id, socket_id=sid)
    
    # Notify all clients in the room
    room_name = f"session_{session_id}"
    await sio.emit("status", {"is_playing": False}, room=room_name)


@sio.event
async def resume(sid, data):
    """Handle resume command from client."""
    session_id = data.get("session_id")
    
    if not session_manager:
        log_warning("socket_resume_failed", socket_id=sid, reason="service_not_initialized")
        await sio.emit("error", {"message": "Service not initialized"}, to=sid)
        return
    
    session = session_manager.get_session(session_id)
    if not session:
        log_warning("socket_resume_failed", socket_id=sid, session_id=session_id, reason="session_not_found")
        await sio.emit("error", {"message": "Session not found"}, to=sid)
        return
    
    await session.resume()
    log_info("session_resumed", session_id=session_id, socket_id=sid)
    
    # Notify all clients in the room
    room_name = f"session_{session_id}"
    await sio.emit("status", {"is_playing": True}, room=room_name)


# REST Endpoints
@fastapi_app.post("/music/start", response_model=StartMusicResponse)
async def start_music(request: StartMusicRequest):
    """
    Start a new music generation session for a book.
    
    Returns a session ID. Client should connect via Socket.IO
    and emit 'join_session' with the session_id.
    """
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    book = request.book
    log_info("session_start_requested", book_title=book.title)
    
    # Generate music prompts from book metadata
    prompts, mood_config = generate_music_prompts(
        title=book.title,
        subjects=book.subjects,
        description=book.description,
        authors=book.authors,
    )
    
    # Get recommended BPM
    bpm = get_recommended_bpm(book.subjects)
    
    # Create Lyria config
    config = LyriaConfig(
        bpm=bpm,
        brightness=mood_config["brightness"],
        density=mood_config["density"],
    )
    
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    # Create and configure session
    try:
        session = await session_manager.create_session(session_id)
        await session.configure(prompts, config)
    except Exception as e:
        log_error("session_create_failed", session_id=session_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")
    
    # Create audio queue for this session
    audio_queues[session_id] = asyncio.Queue(maxsize=100)
    
    # Initialize session metrics
    session_metrics[session_id] = SessionMetrics(
        session_id=session_id,
        start_time=datetime.now(timezone.utc),
        book_title=book.title,
    )
    
    # Store prompts for status endpoint
    prompt_list = [{"text": p.text, "weight": p.weight} for p in prompts]
    session_prompts[session_id] = prompt_list
    
    # Start streaming with callback to queue audio
    def on_audio_chunk(data: bytes):
        metrics = session_metrics.get(session_id)
        try:
            chunk_size = len(data)
            audio_queues[session_id].put_nowait(data)
            # Track received chunks from Lyria
            if metrics:
                metrics.chunks_received += 1
                metrics.bytes_received += chunk_size
            log_debug("audio_chunk_queued", session_id=session_id, chunk_size=chunk_size, queue_size=audio_queues[session_id].qsize())
        except asyncio.QueueFull:
            if metrics:
                metrics.chunks_dropped += 1
            log_warning("audio_chunk_dropped", session_id=session_id, reason="queue_full", chunks_dropped=metrics.chunks_dropped if metrics else 1)
        except Exception as e:
            log_error("audio_chunk_queue_error", session_id=session_id, error=str(e))
    
    await session.start_streaming(on_audio_chunk)
    
    # Start broadcast task
    broadcast_tasks[session_id] = asyncio.create_task(
        broadcast_audio_to_room(session_id)
    )
    
    log_info(
        "session_started",
        session_id=session_id,
        book_title=book.title,
        bpm=bpm,
        prompts=[p.text for p in prompts],
    )
    
    return StartMusicResponse(
        session_id=session_id,
        prompts=prompt_list,
    )


@fastapi_app.post("/music/stop/{session_id}")
async def stop_music(session_id: str):
    """Stop a music session."""
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get final metrics before cleanup
    metrics = session_metrics.get(session_id)
    if metrics:
        log_info(
            "session_stopping",
            session_id=session_id,
            chunks_sent=metrics.chunks_sent,
            bytes_sent=metrics.bytes_sent,
            chunks_dropped=metrics.chunks_dropped,
            duration_seconds=round((datetime.now(timezone.utc) - metrics.start_time).total_seconds(), 1),
        )
    
    # Cancel broadcast task
    task = broadcast_tasks.pop(session_id, None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    
    # Notify clients in the room that session is stopping
    room_name = f"session_{session_id}"
    await sio.emit("session_stopped", {"session_id": session_id}, room=room_name)
    
    # Close all sockets in the room
    await sio.close_room(room_name)
    
    # Clean up queues, prompts, and metrics
    audio_queues.pop(session_id, None)
    session_prompts.pop(session_id, None)
    session_metrics.pop(session_id, None)
    
    # Close session
    await session_manager.close_session(session_id)
    
    log_info("session_stopped", session_id=session_id)
    
    return {"status": "stopped", "session_id": session_id}


@fastapi_app.post("/music/pause/{session_id}")
async def pause_music(session_id: str):
    """Pause a music session."""
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # #region agent log
    import json; open('/Users/calebgibson/Code/ambient-music/.cursor/debug.log','a').write(json.dumps({"location":"main.py:pause_music-pre","message":"about to call session.pause","data":{"session_id":session_id,"session_is_playing":session.is_playing},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","hypothesisId":"H1-H3"})+'\n')
    # #endregion
    await session.pause()
    # #region agent log
    import json; open('/Users/calebgibson/Code/ambient-music/.cursor/debug.log','a').write(json.dumps({"location":"main.py:pause_music-post","message":"pause completed","data":{"session_id":session_id,"session_is_playing":session.is_playing},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","hypothesisId":"H1"})+'\n')
    # #endregion
    log_info("session_paused_rest", session_id=session_id)
    
    # Notify all clients in the room
    room_name = f"session_{session_id}"
    await sio.emit("status", {"is_playing": False}, room=room_name)
    
    return {"status": "paused", "session_id": session_id}


@fastapi_app.post("/music/resume/{session_id}")
async def resume_music(session_id: str):
    """Resume a paused music session."""
    # #region agent log
    import json; open('/Users/calebgibson/Code/ambient-music/.cursor/debug.log','a').write(json.dumps({"location":"main.py:resume_music","message":"resume endpoint called","data":{"session_id":session_id},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","hypothesisId":"H1"})+'\n')
    # #endregion
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # #region agent log
    import json; open('/Users/calebgibson/Code/ambient-music/.cursor/debug.log','a').write(json.dumps({"location":"main.py:resume_music-pre","message":"about to call session.resume","data":{"session_id":session_id,"session_is_playing":session.is_playing},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","hypothesisId":"H1-H2"})+'\n')
    # #endregion
    await session.resume()
    log_info("session_resumed_rest", session_id=session_id)
    
    # Notify all clients in the room
    room_name = f"session_{session_id}"
    await sio.emit("status", {"is_playing": True}, room=room_name)
    
    return {"status": "playing", "session_id": session_id}


@fastapi_app.get("/music/status/{session_id}", response_model=SessionStatusResponse)
async def get_session_status(session_id: str):
    """Get the status of a music session."""
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionStatusResponse(
        session_id=session_id,
        is_playing=session.is_playing,
        prompts=session_prompts.get(session_id, []),
    )


@fastapi_app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "api_key_configured": bool(GEMINI_API_KEY)}


@fastapi_app.get("/metrics")
async def get_metrics():
    """
    Get system and session metrics for observability.
    
    Returns global stats and per-session metrics including:
    - Uptime
    - Active session count
    - Total bytes streamed
    - Per-session: chunks sent/dropped, queue depth, connected clients
    """
    now = datetime.now(timezone.utc)
    uptime_seconds = (now - app_start_time).total_seconds() if app_start_time else 0
    
    # Calculate totals across all sessions
    total_bytes_sent = sum(m.bytes_sent for m in session_metrics.values())
    total_chunks_sent = sum(m.chunks_sent for m in session_metrics.values())
    total_chunks_dropped = sum(m.chunks_dropped for m in session_metrics.values())
    
    # Build per-session metrics
    sessions_data = {}
    for sid, metrics in session_metrics.items():
        queue = audio_queues.get(sid)
        sessions_data[sid] = {
            "book_title": metrics.book_title,
            "start_time": metrics.start_time.isoformat(),
            "duration_seconds": round((now - metrics.start_time).total_seconds(), 1),
            "chunks_received": metrics.chunks_received,
            "bytes_received": metrics.bytes_received,
            "chunks_sent": metrics.chunks_sent,
            "bytes_sent": metrics.bytes_sent,
            "chunks_dropped": metrics.chunks_dropped,
            "drop_rate_percent": round(
                (metrics.chunks_dropped / metrics.chunks_received * 100) 
                if metrics.chunks_received > 0 else 0, 2
            ),
            "queue_depth": queue.qsize() if queue else 0,
            "max_queue_depth": metrics.max_queue_depth,
            "connected_clients": metrics.connected_clients,
        }
    
    return {
        "timestamp": now.isoformat(),
        "uptime_seconds": round(uptime_seconds, 1),
        "active_sessions": len(session_metrics),
        "total_bytes_sent": total_bytes_sent,
        "total_kb_sent": round(total_bytes_sent / 1024, 1),
        "total_chunks_sent": total_chunks_sent,
        "total_chunks_dropped": total_chunks_dropped,
        "sessions": sessions_data,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
