import { useState, useEffect, useCallback, useRef } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { io, Socket } from 'socket.io-client';
import { Book } from '../types/book';
import { API_BASE_URL, SOCKET_IO_URL, AUDIO_CONFIG } from '../config';

// Types for music session state
export type MusicStatus = 'idle' | 'connecting' | 'playing' | 'paused' | 'error';

interface MusicSession {
  sessionId: string;
  prompts: Array<{ text: string; weight: number }>;
}

interface MusicState {
  status: MusicStatus;
  currentBook: Book | null;
  session: MusicSession | null;
  error: string | null;
}

interface UseAmbientMusicResult {
  status: MusicStatus;
  currentBook: Book | null;
  prompts: Array<{ text: string; weight: number }>;
  error: string | null;
  play: (book: Book) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Hook for managing ambient music playback via the Lyria backend.
 * 
 * Handles Socket.IO connection for streaming audio and expo-av for playback.
 */
export function useAmbientMusic(): UseAmbientMusicResult {
  const [state, setState] = useState<MusicState>({
    status: 'idle',
    currentBook: null,
    session: null,
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const soundQueueRef = useRef<Audio.Sound[]>([]);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const audioBufferRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef(false);
  const processingRef = useRef(false);

  // Initialize audio mode
  useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error('Failed to initialize audio mode:', error);
      }
    };

    initAudio();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(async () => {
    // Disconnect Socket.IO
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Unload all sounds in queue
    for (const sound of soundQueueRef.current) {
      try {
        await sound.unloadAsync();
      } catch (e) {
        // Ignore
      }
    }
    soundQueueRef.current = [];

    // Unload current sound
    if (currentSoundRef.current) {
      try {
        await currentSoundRef.current.unloadAsync();
      } catch (e) {
        // Ignore
      }
      currentSoundRef.current = null;
    }

    // Clear buffer
    audioBufferRef.current = [];
    isPlayingRef.current = false;
    processingRef.current = false;
  }, []);

  // Convert base64 to Uint8Array (handles small chunks)
  const base64ToUint8Array = (base64: string): Uint8Array => {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.error('Error decoding base64:', e);
      return new Uint8Array(0);
    }
  };

  // Create a WAV header for PCM data
  const createWavHeader = (dataLength: number): Uint8Array => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const { sampleRate, channels, bitsPerSample } = AUDIO_CONFIG;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);

    // RIFF chunk descriptor
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataLength, true); // File size - 8
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, channels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // data sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLength, true); // Subchunk2Size

    return new Uint8Array(header);
  };

  // Custom base64 encoder that doesn't cause stack overflow
  const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const len = bytes.length;
    
    for (let i = 0; i < len; i += 3) {
      const byte1 = bytes[i];
      const byte2 = i + 1 < len ? bytes[i + 1] : 0;
      const byte3 = i + 2 < len ? bytes[i + 2] : 0;
      
      result += chars[byte1 >> 2];
      result += chars[((byte1 & 3) << 4) | (byte2 >> 4)];
      result += i + 1 < len ? chars[((byte2 & 15) << 2) | (byte3 >> 6)] : '=';
      result += i + 2 < len ? chars[byte3 & 63] : '=';
    }
    
    return result;
  };

  // Play next sound in queue
  const playNextInQueue = useCallback(async () => {
    if (!isPlayingRef.current || soundQueueRef.current.length === 0) {
      return;
    }

    const sound = soundQueueRef.current.shift();
    if (!sound) return;

    try {
      // Unload previous sound
      if (currentSoundRef.current) {
        await currentSoundRef.current.unloadAsync();
      }
      
      currentSoundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
      // Try next sound
      playNextInQueue();
    }
  }, []);

  // Process audio buffer and create sound
  const processAudioBuffer = useCallback(async () => {
    console.log('processAudioBuffer called, isPlaying:', isPlayingRef.current, 'bufferLength:', audioBufferRef.current.length, 'processing:', processingRef.current);
    if (!isPlayingRef.current || audioBufferRef.current.length === 0 || processingRef.current) {
      return;
    }

    processingRef.current = true;

    try {
      // Take chunks from buffer
      const chunks = audioBufferRef.current.splice(0, audioBufferRef.current.length);
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      console.log('Processing', chunks.length, 'chunks, total:', totalLength, 'bytes');
      
      if (totalLength === 0) {
        processingRef.current = false;
        return;
      }

      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // Create WAV data with header
      const wavHeader = createWavHeader(combined.length);
      const wavData = new Uint8Array(wavHeader.length + combined.length);
      wavData.set(wavHeader, 0);
      wavData.set(combined, wavHeader.length);
      console.log('Created WAV data:', wavData.length, 'bytes');

      // Convert to base64 using custom encoder (no stack overflow)
      const base64Audio = uint8ArrayToBase64(wavData);
      const uri = `data:audio/wav;base64,${base64Audio}`;
      console.log('Creating sound from', base64Audio.length, 'char base64 string');

      // Create sound object
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            // Play next queued sound when this one finishes
            sound.unloadAsync().catch(() => {});
            if (currentSoundRef.current === sound) {
              currentSoundRef.current = null;
            }
            playNextInQueue();
          }
        }
      );
      console.log('Sound created successfully');

      // Add to queue
      soundQueueRef.current.push(sound);
      console.log('Sound added to queue, queue size:', soundQueueRef.current.length);

      // Start playing if nothing is currently playing
      if (!currentSoundRef.current && isPlayingRef.current) {
        console.log('Starting playback...');
        playNextInQueue();
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    } finally {
      processingRef.current = false;
    }
  }, [playNextInQueue]);

  // Handle incoming audio chunk from Socket.IO
  const handleAudioChunk = useCallback((data: { data: string }) => {
    console.log('Received audio_chunk event, data length:', data.data?.length ?? 0);
    if (!data.data) return;
    
    // Buffer audio chunk
    const audioData = base64ToUint8Array(data.data);
    console.log('Decoded audio chunk:', audioData.length, 'bytes');
    if (audioData.length > 0) {
      audioBufferRef.current.push(audioData);

      // Process buffer when we have enough data (~0.5 second of audio)
      // At 48kHz stereo 16-bit, 0.5 second = 96000 bytes
      const totalBuffered = audioBufferRef.current.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );
      console.log('Total buffered:', totalBuffered, 'bytes');
      if (totalBuffered >= 96000 && !processingRef.current) {
        console.log('Processing audio buffer...');
        processAudioBuffer();
      }
    }
  }, [processAudioBuffer]);

  // Handle status updates from Socket.IO
  const handleStatus = useCallback((data: { is_playing: boolean }) => {
    setState(prev => ({
      ...prev,
      status: data.is_playing ? 'playing' : 'paused',
    }));
  }, []);

  // Start music for a book
  const play = useCallback(async (book: Book) => {
    // Cleanup any existing session
    await cleanup();

    setState({
      status: 'connecting',
      currentBook: book,
      session: null,
      error: null,
    });

    try {
      // Connect to Socket.IO server
      const socket = io(SOCKET_IO_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      // Set up Socket.IO event listeners
      socket.on('connect', () => {
        console.log('Socket.IO connected');
      });

      socket.on('connect_error', (error: Error) => {
        console.error('Socket.IO connection error:', error);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Connection error',
        }));
      });

      socket.on('disconnect', (reason: string) => {
        console.log('Socket.IO disconnected:', reason);
        isPlayingRef.current = false;
      });

      socket.on('audio_chunk', handleAudioChunk);
      socket.on('status', handleStatus);

      socket.on('error', (data: { message: string }) => {
        console.error('Socket.IO error:', data.message);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: data.message,
        }));
      });

      socket.on('session_stopped', () => {
        isPlayingRef.current = false;
        setState(prev => ({
          ...prev,
          status: 'idle',
        }));
      });

      // Wait for Socket.IO to connect
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket.IO connection timeout'));
        }, 10000);

        socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        socket.once('connect_error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Start session via REST API
      const response = await fetch(`${API_BASE_URL}/music/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book: {
            title: book.title,
            authors: book.authors,
            subjects: book.subjects,
            description: undefined,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start music session');
      }

      const data = await response.json();
      const { session_id, prompts } = data;

      // Join the session room via Socket.IO
      socket.emit('join_session', { session_id });

      // Wait for session_joined confirmation
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Failed to join session'));
        }, 5000);

        socket.once('session_joined', () => {
          clearTimeout(timeout);
          isPlayingRef.current = true;
          setState(prev => ({
            ...prev,
            status: 'playing',
            session: { sessionId: session_id, prompts },
          }));
          resolve();
        });

        socket.once('error', (data: { message: string }) => {
          clearTimeout(timeout);
          reject(new Error(data.message));
        });
      });
    } catch (error) {
      console.error('Error starting music:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [cleanup, handleAudioChunk, handleStatus]);

  // Pause music
  const pause = useCallback(async () => {
    if (!state.session || !socketRef.current) return;

    try {
      // Send pause command via REST API
      const response = await fetch(`${API_BASE_URL}/music/pause/${state.session.sessionId}`, {
        method: 'POST',
      });

      if (response.status === 404) {
        // Session no longer exists on server, reset state
        console.warn('Session not found, resetting state');
        await cleanup();
        setState({
          status: 'idle',
          currentBook: null,
          session: null,
          error: null,
        });
        return;
      }

      isPlayingRef.current = false;
      setState(prev => ({ ...prev, status: 'paused' }));

      // Pause current sound
      if (currentSoundRef.current) {
        try {
          const status = await currentSoundRef.current.getStatusAsync();
          if (status.isLoaded) {
            await currentSoundRef.current.pauseAsync();
          }
        } catch (e) {
          // Ignore if sound not loaded
        }
      }
    } catch (error) {
      console.error('Error pausing music:', error);
    }
  }, [state.session, cleanup]);

  // Resume music
  const resume = useCallback(async () => {
    if (!state.session || !socketRef.current) return;

    try {
      // Send resume command via REST API
      const response = await fetch(`${API_BASE_URL}/music/resume/${state.session.sessionId}`, {
        method: 'POST',
      });

      if (response.status === 404) {
        // Session no longer exists on server, reset state
        console.warn('Session not found, resetting state');
        await cleanup();
        setState({
          status: 'idle',
          currentBook: null,
          session: null,
          error: null,
        });
        return;
      }

      isPlayingRef.current = true;
      setState(prev => ({ ...prev, status: 'playing' }));

      // Resume current sound or play next in queue
      if (currentSoundRef.current) {
        try {
          const status = await currentSoundRef.current.getStatusAsync();
          if (status.isLoaded) {
            await currentSoundRef.current.playAsync();
          }
        } catch (e) {
          // Ignore if sound not loaded
        }
      } else {
        playNextInQueue();
      }
    } catch (error) {
      console.error('Error resuming music:', error);
    }
  }, [state.session, playNextInQueue, cleanup]);

  // Stop music
  const stop = useCallback(async () => {
    if (state.session) {
      try {
        // Send stop command via REST API
        await fetch(`${API_BASE_URL}/music/stop/${state.session.sessionId}`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Error stopping music session:', error);
      }
    }

    await cleanup();

    setState({
      status: 'idle',
      currentBook: null,
      session: null,
      error: null,
    });
  }, [state.session, cleanup]);

  return {
    status: state.status,
    currentBook: state.currentBook,
    prompts: state.session?.prompts ?? [],
    error: state.error,
    play,
    pause,
    resume,
    stop,
  };
}
