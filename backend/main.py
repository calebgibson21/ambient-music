"""
FastAPI backend for Lyria ambient music streaming.

Provides REST endpoints to start/stop music sessions and 
WebSocket endpoint for streaming audio to clients.
"""

import asyncio
import base64
import os
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
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

# WebSocket connections per session
websocket_connections: dict[str, list[WebSocket]] = {}

# Audio queues for each session (to buffer chunks for WebSocket clients)
audio_queues: dict[str, asyncio.Queue] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global session_manager
    session_manager = LyriaSessionManager(GEMINI_API_KEY)
    yield
    # Cleanup on shutdown
    await session_manager.close_all()


app = FastAPI(
    title="Ambient Music API",
    description="Stream AI-generated ambient music based on book themes",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    websocket_url: str
    prompts: list[dict[str, float | str]]


class SessionStatusResponse(BaseModel):
    """Current session status."""
    session_id: str
    is_playing: bool
    prompts: list[dict[str, float | str]]


# Helper to broadcast audio to connected WebSocket clients
async def broadcast_audio_to_clients(session_id: str) -> None:
    """
    Background task that reads from the audio queue and 
    broadcasts to all connected WebSocket clients.
    """
    queue = audio_queues.get(session_id)
    if not queue:
        return
    
    while True:
        try:
            audio_data = await asyncio.wait_for(queue.get(), timeout=1.0)
            
            # Get connected clients for this session
            clients = websocket_connections.get(session_id, [])
            
            if clients:
                # Encode audio as base64 for WebSocket transmission
                encoded = base64.b64encode(audio_data).decode('utf-8')
                message = {"type": "audio", "data": encoded}
                
                # Send to all clients
                disconnected = []
                for ws in clients:
                    try:
                        await ws.send_json(message)
                    except Exception:
                        disconnected.append(ws)
                
                # Remove disconnected clients
                for ws in disconnected:
                    clients.remove(ws)
            
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


# Stored prompts per session for status endpoint
session_prompts: dict[str, list[dict]] = {}

# Broadcast tasks
broadcast_tasks: dict[str, asyncio.Task] = {}


@app.post("/music/start", response_model=StartMusicResponse)
async def start_music(request: StartMusicRequest):
    """
    Start a new music generation session for a book.
    
    Returns a session ID and WebSocket URL for streaming audio.
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
    websocket_connections[session_id] = []
    
    # Store prompts for status endpoint
    prompt_list = [{"text": p.text, "weight": p.weight} for p in prompts]
    session_prompts[session_id] = prompt_list
    
    # Start streaming with callback to queue audio
    def on_audio_chunk(data: bytes):
        try:
            audio_queues[session_id].put_nowait(data)
        except asyncio.QueueFull:
            pass  # Drop oldest if queue is full
    
    await session.start_streaming(on_audio_chunk)
    
    # Start broadcast task
    broadcast_tasks[session_id] = asyncio.create_task(
        broadcast_audio_to_clients(session_id)
    )
    
    return StartMusicResponse(
        session_id=session_id,
        websocket_url=f"/music/stream/{session_id}",
        prompts=prompt_list,
    )


@app.post("/music/stop/{session_id}")
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
    
    # Close all WebSocket connections
    clients = websocket_connections.pop(session_id, [])
    for ws in clients:
        try:
            await ws.close()
        except Exception:
            pass
    
    # Clean up queues and prompts
    audio_queues.pop(session_id, None)
    session_prompts.pop(session_id, None)
    
    # Close session
    await session_manager.close_session(session_id)
    
    return {"status": "stopped", "session_id": session_id}


@app.post("/music/pause/{session_id}")
async def pause_music(session_id: str):
    """Pause a music session."""
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await session.pause()
    return {"status": "paused", "session_id": session_id}


@app.post("/music/resume/{session_id}")
async def resume_music(session_id: str):
    """Resume a paused music session."""
    if not session_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await session.resume()
    return {"status": "playing", "session_id": session_id}


@app.get("/music/status/{session_id}", response_model=SessionStatusResponse)
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


@app.websocket("/music/stream/{session_id}")
async def websocket_stream(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for streaming audio to clients.
    
    Clients receive JSON messages with base64-encoded PCM audio:
    {"type": "audio", "data": "<base64 encoded PCM16 audio>"}
    """
    if not session_manager:
        await websocket.close(code=1013, reason="Service not initialized")
        return
    
    session = session_manager.get_session(session_id)
    if not session:
        await websocket.close(code=1008, reason="Session not found")
        return
    
    await websocket.accept()
    
    # Add to connection list
    if session_id not in websocket_connections:
        websocket_connections[session_id] = []
    websocket_connections[session_id].append(websocket)
    
    # Send initial status
    await websocket.send_json({
        "type": "status",
        "is_playing": session.is_playing,
        "sample_rate": 48000,
        "channels": 2,
        "format": "pcm16",
    })
    
    try:
        # Keep connection alive and handle client messages
        while True:
            try:
                message = await websocket.receive_json()
                
                # Handle control messages from client
                if message.get("type") == "pause":
                    await session.pause()
                    await websocket.send_json({"type": "status", "is_playing": False})
                elif message.get("type") == "resume":
                    await session.resume()
                    await websocket.send_json({"type": "status", "is_playing": True})
                elif message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except Exception:
                # Client disconnected or invalid message
                break
    except WebSocketDisconnect:
        pass
    finally:
        # Remove from connection list
        if session_id in websocket_connections:
            try:
                websocket_connections[session_id].remove(websocket)
            except ValueError:
                pass


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "api_key_configured": bool(GEMINI_API_KEY)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
