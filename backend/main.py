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
from typing import Optional

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from lyria_client import LyriaConfig, LyriaSession, LyriaSessionManager
from prompt_generator import generate_music_prompts, get_recommended_bpm

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is required")


# Global session manager
session_manager: Optional[LyriaSessionManager] = None

# Audio queues for each session (to buffer chunks for Socket.IO clients)
audio_queues: dict[str, asyncio.Queue] = {}

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
    global session_manager
    session_manager = LyriaSessionManager(GEMINI_API_KEY)
    yield
    # Cleanup on shutdown
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
    print(f"Broadcast task started for session {session_id}")
    queue = audio_queues.get(session_id)
    if not queue:
        print("No queue found!")
        return
    
    room_name = f"session_{session_id}"
    chunk_count = 0
    total_bytes = 0
    
    while True:
        try:
            print(f"Waiting for audio from queue (size: {queue.qsize()})...")
            audio_data = await asyncio.wait_for(queue.get(), timeout=1.0)
            print(f"Got audio chunk from queue: {len(audio_data)} bytes")
            
            # Encode audio as base64 for transmission
            print("Encoding to base64...")
            encoded = base64.b64encode(audio_data).decode('utf-8')
            print(f"Encoded size: {len(encoded)} chars, emitting to room {room_name}...")
            
            # Emit to all clients in the session room
            await sio.emit("audio_chunk", {"data": encoded}, room=room_name)
            print("Emit complete")
            
            chunk_count += 1
            total_bytes += len(audio_data)
            
            # Log every 50 chunks (~1 second of audio at typical chunk rates)
            if chunk_count % 50 == 0:
                print(f"Audio streaming: {chunk_count} chunks sent ({total_bytes / 1024:.1f} KB)")
            
            queue.task_done()
        except asyncio.TimeoutError:
            # Check if session still exists
            if session_id not in audio_queues:
                break
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Broadcast error: {e}")
            break
    
    print(f"Audio broadcast ended: {chunk_count} total chunks ({total_bytes / 1024:.1f} KB)")


# Stored prompts per session for status endpoint
session_prompts: dict[str, list[dict]] = {}

# Broadcast tasks
broadcast_tasks: dict[str, asyncio.Task] = {}


# Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    print(f"Client disconnected: {sid}")
    # Clean up session mapping
    session_id = socket_sessions.pop(sid, None)
    if session_id:
        room_name = f"session_{session_id}"
        await sio.leave_room(sid, room_name)


@sio.event
async def join_session(sid, data):
    """
    Handle client joining a music session.
    
    Expected data: {"session_id": "uuid"}
    """
    session_id = data.get("session_id")
    print(f"Client {sid} requesting to join session: {session_id}")
    
    if not session_manager:
        await sio.emit("error", {"message": "Service not initialized"}, to=sid)
        return
    
    session = session_manager.get_session(session_id)
    if not session:
        print(f"Session {session_id} not found")
        await sio.emit("error", {"message": "Session not found"}, to=sid)
        return
    
    # Join the session room
    room_name = f"session_{session_id}"
    await sio.enter_room(sid, room_name)
    socket_sessions[sid] = session_id
    print(f"Client {sid} joined room {room_name}")
    
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


@sio.event
async def pause(sid, data):
    """Handle pause command from client."""
    session_id = data.get("session_id")
    
    if not session_manager:
        await sio.emit("error", {"message": "Service not initialized"}, to=sid)
        return
    
    session = session_manager.get_session(session_id)
    if not session:
        await sio.emit("error", {"message": "Session not found"}, to=sid)
        return
    
    await session.pause()
    
    # Notify all clients in the room
    room_name = f"session_{session_id}"
    await sio.emit("status", {"is_playing": False}, room=room_name)


@sio.event
async def resume(sid, data):
    """Handle resume command from client."""
    session_id = data.get("session_id")
    
    if not session_manager:
        await sio.emit("error", {"message": "Service not initialized"}, to=sid)
        return
    
    session = session_manager.get_session(session_id)
    if not session:
        await sio.emit("error", {"message": "Session not found"}, to=sid)
        return
    
    await session.resume()
    
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")
    
    # Create audio queue for this session
    audio_queues[session_id] = asyncio.Queue(maxsize=100)
    
    # Store prompts for status endpoint
    prompt_list = [{"text": p.text, "weight": p.weight} for p in prompts]
    session_prompts[session_id] = prompt_list
    
    # Start streaming with callback to queue audio
    def on_audio_chunk(data: bytes):
        try:
            print(f"Queueing audio chunk: {len(data)} bytes")
            audio_queues[session_id].put_nowait(data)
            print(f"Chunk queued, queue size: {audio_queues[session_id].qsize()}")
        except asyncio.QueueFull:
            print("Queue full, dropping chunk")
        except Exception as e:
            print(f"Error queueing chunk: {e}")
    
    await session.start_streaming(on_audio_chunk)
    
    # Start broadcast task
    broadcast_tasks[session_id] = asyncio.create_task(
        broadcast_audio_to_room(session_id)
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
    
    # Clean up queues and prompts
    audio_queues.pop(session_id, None)
    session_prompts.pop(session_id, None)
    
    # Close session
    await session_manager.close_session(session_id)
    
    return {"status": "stopped", "session_id": session_id}


@fastapi_app.post("/music/pause/{session_id}")
async def pause_music(session_id: str):
    """Pause a music session."""
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await session.pause()
    
    # Notify all clients in the room
    room_name = f"session_{session_id}"
    await sio.emit("status", {"is_playing": False}, room=room_name)
    
    return {"status": "paused", "session_id": session_id}


@fastapi_app.post("/music/resume/{session_id}")
async def resume_music(session_id: str):
    """Resume a paused music session."""
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await session.resume()
    
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
