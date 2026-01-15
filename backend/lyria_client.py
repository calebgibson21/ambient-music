"""
Lyria RealTime client wrapper for managing music generation sessions.
"""

import asyncio
from dataclasses import dataclass
from typing import Callable, Optional
from google import genai
from google.genai import types

from logging_config import log_info, log_warning, log_error, log_debug
from prompt_generator import WeightedPrompt


@dataclass
class LyriaConfig:
    """Configuration for Lyria music generation."""
    bpm: int = 80
    temperature: float = 1.0
    brightness: float = 0.5
    density: float = 0.5
    guidance: float = 4.0
    sample_rate_hz: int = 48000
    audio_format: str = "pcm16"


class LyriaSession:
    """
    Manages a Lyria RealTime music generation session.
    
    Handles connection to the Lyria API, prompt management,
    and audio chunk streaming.
    """
    
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._client = genai.Client(
            api_key=api_key,
            http_options={'api_version': 'v1alpha'}
        )
        self._session = None
        self._context_manager = None
        self._is_playing = False
        self._audio_task: Optional[asyncio.Task] = None
        self._on_audio_chunk: Optional[Callable[[bytes], None]] = None
        self._prompts: list[WeightedPrompt] = []
        self._config: Optional[LyriaConfig] = None
    
    @property
    def is_playing(self) -> bool:
        return self._is_playing
    
    async def connect(self) -> None:
        """Establish connection to Lyria RealTime API."""
        try:
            log_info("lyria_connecting", model="lyria-realtime-exp")
            # Get the async context manager
            self._context_manager = self._client.aio.live.music.connect(
                model='models/lyria-realtime-exp'
            )
            # Enter the context manager to get the session
            self._session = await self._context_manager.__aenter__()
            log_info("lyria_connected")
        except Exception as e:
            log_error("lyria_connect_failed", error=str(e))
            raise
    
    async def configure(
        self,
        prompts: list[WeightedPrompt],
        config: LyriaConfig,
    ) -> None:
        """Configure the session with prompts and generation settings."""
        if not self._session:
            raise RuntimeError("Session not connected. Call connect() first.")
        
        self._prompts = prompts
        self._config = config
        
        try:
            # Set weighted prompts
            lyria_prompts = [
                types.WeightedPrompt(text=p.text, weight=p.weight)
                for p in prompts
            ]
            log_info("lyria_setting_prompts", prompts=[p.text for p in prompts])
            await self._session.set_weighted_prompts(prompts=lyria_prompts)
            
            # Set generation config (audio_format and sample_rate_hz are fixed by the API)
            log_info("lyria_setting_config", bpm=config.bpm, brightness=config.brightness, density=config.density)
            await self._session.set_music_generation_config(
                config=types.LiveMusicGenerationConfig(
                    bpm=config.bpm,
                    temperature=config.temperature,
                    brightness=config.brightness,
                    density=config.density,
                    guidance=config.guidance,
                )
            )
            log_info("lyria_configured")
        except Exception as e:
            log_error("lyria_configure_failed", error=str(e))
            raise
    
    async def start_streaming(
        self,
        on_audio_chunk: Callable[[bytes], None],
    ) -> None:
        """
        Start streaming music and call the callback for each audio chunk.
        
        Args:
            on_audio_chunk: Callback function that receives raw PCM audio bytes
        """
        if not self._session:
            raise RuntimeError("Session not connected. Call connect() first.")
        
        self._on_audio_chunk = on_audio_chunk
        self._is_playing = True
        
        try:
            # Start playback
            log_info("lyria_starting_playback")
            await self._session.play()
            log_info("lyria_playback_started")
            
            # Start receiving audio in background
            self._audio_task = asyncio.create_task(self._receive_audio_loop())
        except Exception as e:
            log_error("lyria_start_streaming_failed", error=str(e))
            raise
    
    async def _receive_audio_loop(self) -> None:
        """Background task to receive and forward audio chunks."""
        if not self._session:
            return
        
        log_info("lyria_receive_loop_started")
        chunk_count = 0
        total_bytes = 0
        try:
            async for message in self._session.receive():
                if not self._is_playing:
                    break
                
                if message.server_content and message.server_content.audio_chunks:
                    for chunk in message.server_content.audio_chunks:
                        if self._on_audio_chunk and chunk.data:
                            chunk_count += 1
                            total_bytes += len(chunk.data)
                            if chunk_count % 50 == 1:
                                log_debug("lyria_chunk_received", chunk_number=chunk_count, chunk_size=len(chunk.data))
                            self._on_audio_chunk(chunk.data)
                
                # Small yield to prevent blocking
                await asyncio.sleep(0)
        except asyncio.CancelledError:
            log_info("lyria_receive_loop_cancelled", chunks_received=chunk_count, total_bytes=total_bytes)
        except Exception as e:
            log_error("lyria_receive_error", error=str(e), chunks_received=chunk_count)
    
    async def update_prompts(self, prompts: list[WeightedPrompt]) -> None:
        """Update the music prompts while streaming."""
        if not self._session:
            raise RuntimeError("Session not connected.")
        
        lyria_prompts = [
            types.WeightedPrompt(text=p.text, weight=p.weight)
            for p in prompts
        ]
        await self._session.set_weighted_prompts(prompts=lyria_prompts)
    
    async def pause(self) -> None:
        """Pause music playback."""
        if self._session and self._is_playing:
            await self._session.pause()
            self._is_playing = False
    
    async def resume(self) -> None:
        """Resume music playback."""
        if self._session and not self._is_playing:
            await self._session.play()
            self._is_playing = True
    
    async def stop(self) -> None:
        """Stop music playback and clean up."""
        self._is_playing = False
        
        if self._audio_task:
            self._audio_task.cancel()
            try:
                await self._audio_task
            except asyncio.CancelledError:
                pass
            self._audio_task = None
        
        if self._session:
            try:
                await self._session.stop()
                log_info("lyria_session_stopped")
            except Exception as e:
                log_error("lyria_stop_error", error=str(e))
    
    async def close(self) -> None:
        """Close the session and release resources."""
        await self.stop()
        
        # Exit the context manager properly
        if self._context_manager:
            try:
                await self._context_manager.__aexit__(None, None, None)
                log_info("lyria_session_closed")
            except Exception as e:
                log_error("lyria_close_error", error=str(e))
            self._context_manager = None
        
        self._session = None


class LyriaSessionManager:
    """
    Manages multiple Lyria sessions for different clients.
    """
    
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._sessions: dict[str, LyriaSession] = {}
    
    async def create_session(self, session_id: str) -> LyriaSession:
        """Create and connect a new Lyria session."""
        if session_id in self._sessions:
            await self.close_session(session_id)
        
        session = LyriaSession(self._api_key)
        await session.connect()
        self._sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[LyriaSession]:
        """Get an existing session by ID."""
        return self._sessions.get(session_id)
    
    async def close_session(self, session_id: str) -> None:
        """Close and remove a session."""
        session = self._sessions.pop(session_id, None)
        if session:
            await session.close()
    
    async def close_all(self) -> None:
        """Close all active sessions."""
        for session_id in list(self._sessions.keys()):
            await self.close_session(session_id)
