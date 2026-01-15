import { useState, useEffect, useCallback, useRef } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { io, Socket } from 'socket.io-client';
import { Book } from '../types/book';
import { API_BASE_URL, SOCKET_IO_URL, AUDIO_CONFIG } from '../config';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger';

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

/**
 * Buffer metrics for observability.
 * Tracks streaming health and performance.
 */
export interface BufferMetrics {
  chunksReceived: number;
  bytesReceived: number;
  bufferUnderruns: number;
  soundsCreated: number;
  soundsPlayed: number;
  lastChunkTimestamp: number;
  isAudioPlaying: boolean;  // True when audio is actually playing through speakers
}

interface UseAmbientMusicResult {
  status: MusicStatus;
  currentBook: Book | null;
  prompts: Array<{ text: string; weight: number }>;
  error: string | null;
  metrics: BufferMetrics;
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

// Minimum number of sounds to buffer before starting playback
const MIN_SOUNDS_BEFORE_PLAYBACK = 2;

// Combine multiple chunks into longer sounds to reduce crossfade frequency
// At 48kHz stereo 16-bit: 768,000 bytes = 4 seconds of audio (2 chunks worth)
// This ensures chunks arrive faster than sounds are consumed
const MIN_BYTES_PER_SOUND = 768000;

// PCM crossfade duration in milliseconds (for waveform blending)
// At 48kHz stereo 16-bit: 250ms = 48000 * 0.25 * 2 * 2 = 48000 bytes
const PCM_CROSSFADE_DURATION_MS = 250;
const CROSSFADE_SAMPLES = Math.floor(AUDIO_CONFIG.sampleRate * (PCM_CROSSFADE_DURATION_MS / 1000));
const CROSSFADE_BYTES = CROSSFADE_SAMPLES * AUDIO_CONFIG.channels * (AUDIO_CONFIG.bitsPerSample / 8);

// Volume crossfade duration for overlapping playback (ms)
// Start next sound this many ms before current ends
const VOLUME_CROSSFADE_MS = 400;
// How often to update volumes during crossfade (ms)
const VOLUME_UPDATE_INTERVAL_MS = 20;

/**
 * Apply equal-power crossfade between two PCM audio buffers.
 * Formula: out[i] = chunk_a[i] * sqrt(1 - t) + chunk_b[i] * sqrt(t)
 * 
 * @param tailBuffer - End of previous audio chunk (to fade out)
 * @param headBuffer - Start of new audio chunk (to fade in)
 * @returns Crossfaded audio buffer
 */
function applyEqualPowerCrossfade(tailBuffer: Uint8Array, headBuffer: Uint8Array): Uint8Array {
  const fadeLength = Math.min(tailBuffer.length, headBuffer.length);
  const result = new Uint8Array(fadeLength);
  
  // Process as 16-bit samples (2 bytes per sample)
  const tailView = new DataView(tailBuffer.buffer, tailBuffer.byteOffset, tailBuffer.byteLength);
  const headView = new DataView(headBuffer.buffer, headBuffer.byteOffset, headBuffer.byteLength);
  const resultView = new DataView(result.buffer);
  
  const numSamples = fadeLength / 2; // 16-bit = 2 bytes per sample
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples; // 0 to 1
    
    // Equal-power crossfade coefficients
    const fadeOut = Math.sqrt(1 - t);
    const fadeIn = Math.sqrt(t);
    
    // Read 16-bit signed samples (little-endian)
    const sampleA = tailView.getInt16(i * 2, true);
    const sampleB = headView.getInt16(i * 2, true);
    
    // Apply crossfade
    const mixed = Math.round(sampleA * fadeOut + sampleB * fadeIn);
    
    // Clamp to 16-bit range
    const clamped = Math.max(-32768, Math.min(32767, mixed));
    
    // Write result
    resultView.setInt16(i * 2, clamped, true);
  }
  
  return result;
}

const initialMetrics: BufferMetrics = {
  chunksReceived: 0,
  bytesReceived: 0,
  bufferUnderruns: 0,
  soundsCreated: 0,
  soundsPlayed: 0,
  lastChunkTimestamp: 0,
  isAudioPlaying: false,
};

export function useAmbientMusic(): UseAmbientMusicResult {
  const [state, setState] = useState<MusicState>({
    status: 'idle',
    currentBook: null,
    session: null,
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const soundQueueRef = useRef<{ sound: Audio.Sound; durationMs: number; soundId: number }[]>([]);
  const currentSoundRef = useRef<{ sound: Audio.Sound; durationMs: number; soundId: number } | null>(null);
  const outgoingSoundRef = useRef<Audio.Sound | null>(null);  // Sound being faded out
  const audioBufferRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef(false);
  const processingRef = useRef(false);
  const initialPlaybackStartedRef = useRef(false);  // Track if we've started initial playback
  const metricsRef = useRef<BufferMetrics>({ ...initialMetrics });
  const [metrics, setMetrics] = useState<BufferMetrics>({ ...initialMetrics });
  
  // Timing observability refs
  const lastSoundStartTimeRef = useRef<number>(0);
  const lastSoundFinishTimeRef = useRef<number>(0);
  const soundIdCounterRef = useRef<number>(0);
  
  // Volume crossfade state
  const crossfadeInProgressRef = useRef(false);
  const crossfadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Crossfade: store the tail of the previous audio chunk
  const previousAudioTailRef = useRef<Uint8Array | null>(null);

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
        logInfo('audio_mode_initialized');
      } catch (error) {
        logError('audio_mode_init_failed', { error: String(error) });
      }
    };

    initAudio();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(async () => {
    logInfo('cleanup_started', {
      chunksReceived: metricsRef.current.chunksReceived,
      bytesReceived: metricsRef.current.bytesReceived,
      bufferUnderruns: metricsRef.current.bufferUnderruns,
    });

    // Clear crossfade interval
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    crossfadeInProgressRef.current = false;

    // Disconnect Socket.IO
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Unload all sounds in queue
    for (const item of soundQueueRef.current) {
      try {
        await item.sound.unloadAsync();
      } catch (e) {
        // Ignore
      }
    }
    soundQueueRef.current = [];

    // Unload current sound
    if (currentSoundRef.current) {
      try {
        await currentSoundRef.current.sound.unloadAsync();
      } catch (e) {
        // Ignore
      }
      currentSoundRef.current = null;
    }

    // Unload outgoing sound
    if (outgoingSoundRef.current) {
      try {
        await outgoingSoundRef.current.unloadAsync();
      } catch (e) {
        // Ignore
      }
      outgoingSoundRef.current = null;
    }

    // Clear buffer and reset metrics
    audioBufferRef.current = [];
    isPlayingRef.current = false;
    processingRef.current = false;
    initialPlaybackStartedRef.current = false;
    metricsRef.current = { ...initialMetrics };
    setMetrics({ ...initialMetrics });
    
    // Reset timing refs
    lastSoundStartTimeRef.current = 0;
    lastSoundFinishTimeRef.current = 0;
    soundIdCounterRef.current = 0;
    
    // Reset crossfade state
    previousAudioTailRef.current = null;
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
      logError('base64_decode_error', { error: String(e) });
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

  // Start volume crossfade between outgoing and incoming sounds
  const startVolumeCrossfade = useCallback((outgoingSound: Audio.Sound, incomingSound: Audio.Sound, incomingSoundId: number) => {
    if (crossfadeInProgressRef.current) {
      logDebug('crossfade_already_in_progress');
      return;
    }
    
    crossfadeInProgressRef.current = true;
    const startTime = Date.now();
    
    logInfo('volume_crossfade_started', { 
      soundId: incomingSoundId,
      durationMs: VOLUME_CROSSFADE_MS,
    });
    
    // Start incoming sound at volume 0
    incomingSound.setVolumeAsync(0).catch(() => {});
    incomingSound.playAsync().catch(() => {});
    
    crossfadeIntervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / VOLUME_CROSSFADE_MS);
      
      // Equal-power crossfade for volume
      const outgoingVolume = Math.sqrt(1 - t);
      const incomingVolume = Math.sqrt(t);
      
      try {
        await Promise.all([
          outgoingSound.setVolumeAsync(outgoingVolume),
          incomingSound.setVolumeAsync(incomingVolume),
        ]);
      } catch (e) {
        // Sound may have been unloaded
      }
      
      if (t >= 1) {
        // Crossfade complete
        if (crossfadeIntervalRef.current) {
          clearInterval(crossfadeIntervalRef.current);
          crossfadeIntervalRef.current = null;
        }
        crossfadeInProgressRef.current = false;
        
        // Clean up outgoing sound
        outgoingSound.stopAsync().catch(() => {});
        outgoingSound.unloadAsync().catch(() => {});
        outgoingSoundRef.current = null;
        
        logInfo('volume_crossfade_completed', { soundId: incomingSoundId });
      }
    }, VOLUME_UPDATE_INTERVAL_MS);
  }, []);

  // Play next sound in queue (with overlapping crossfade)
  const playNextInQueue = useCallback(async (isOverlap: boolean = false) => {
    const callTime = Date.now();
    
    if (!isPlayingRef.current) {
      return;
    }

    const queueLengthBefore = soundQueueRef.current.length;
    
    if (queueLengthBefore === 0) {
      // Buffer underrun - queue is empty while we're supposed to be playing
      // Only count as underrun if we've already started initial playback and not in crossfade
      if (initialPlaybackStartedRef.current && !isOverlap) {
        metricsRef.current.bufferUnderruns++;
        setMetrics({ ...metricsRef.current });
        logWarn('buffer_underrun', {
          bufferUnderruns: metricsRef.current.bufferUnderruns,
          soundsPlayed: metricsRef.current.soundsPlayed,
          soundsCreated: metricsRef.current.soundsCreated,
          timeSinceLastFinish: lastSoundFinishTimeRef.current ? callTime - lastSoundFinishTimeRef.current : 0,
        });
      }
      return;
    }

    const nextItem = soundQueueRef.current.shift();
    if (!nextItem) return;

    // Calculate gap since last sound finished
    const gapSinceFinish = lastSoundFinishTimeRef.current ? callTime - lastSoundFinishTimeRef.current : 0;
    const gapSinceLastStart = lastSoundStartTimeRef.current ? callTime - lastSoundStartTimeRef.current : 0;

    try {
      if (isOverlap && currentSoundRef.current) {
        // Overlapping playback: start crossfade
        outgoingSoundRef.current = currentSoundRef.current.sound;
        currentSoundRef.current = nextItem;
        
        startVolumeCrossfade(outgoingSoundRef.current, nextItem.sound, nextItem.soundId);
        
        lastSoundStartTimeRef.current = Date.now();
        metricsRef.current.soundsPlayed++;
        setMetrics({ ...metricsRef.current });
        
        logInfo('sound_playback_timing', {
          soundId: nextItem.soundId,
          gapSinceLastFinishMs: gapSinceFinish,
          gapSinceLastStartMs: gapSinceLastStart,
          playAsyncDurationMs: 0,
          queueLengthAfter: soundQueueRef.current.length,
          overlapping: true,
        });
      } else {
        // Non-overlapping: clean start (first sound or after underrun)
        const previousSound = currentSoundRef.current;
        if (previousSound) {
          previousSound.sound.unloadAsync().catch(() => {});
        }
        
        currentSoundRef.current = nextItem;
        
        const beforePlay = Date.now();
        await nextItem.sound.setVolumeAsync(1);
        await nextItem.sound.playAsync();
        const afterPlay = Date.now();
        
        lastSoundStartTimeRef.current = afterPlay;
        metricsRef.current.soundsPlayed++;
        setMetrics({ ...metricsRef.current });
        
        logInfo('sound_playback_timing', {
          soundId: nextItem.soundId,
          gapSinceLastFinishMs: gapSinceFinish,
          gapSinceLastStartMs: gapSinceLastStart,
          playAsyncDurationMs: afterPlay - beforePlay,
          queueLengthAfter: soundQueueRef.current.length,
          overlapping: false,
        });
      }
    } catch (error) {
      logError('sound_playback_error', { error: String(error) });
      // Try next sound
      playNextInQueue(false);
    }
  }, [startVolumeCrossfade]);

  // Process audio buffer and create sound
  const processAudioBuffer = useCallback(async () => {
    logDebug('process_audio_buffer_called', {
      isPlaying: isPlayingRef.current,
      bufferLength: audioBufferRef.current.length,
      processing: processingRef.current,
    });
    
    if (!isPlayingRef.current || audioBufferRef.current.length === 0 || processingRef.current) {
      return;
    }

    processingRef.current = true;

    try {
      // Take chunks from buffer
      const chunks = audioBufferRef.current.splice(0, audioBufferRef.current.length);
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      logDebug('processing_chunks', { chunkCount: chunks.length, totalBytes: totalLength });
      
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

      // Apply crossfade with previous chunk's tail (if available)
      let audioToEncode: Uint8Array;
      const hasPreviousTail = previousAudioTailRef.current !== null && previousAudioTailRef.current.length > 0;
      
      if (hasPreviousTail && combined.length >= CROSSFADE_BYTES) {
        const previousTail = previousAudioTailRef.current!;
        const currentHead = combined.slice(0, CROSSFADE_BYTES);
        
        // Apply equal-power crossfade
        const crossfaded = applyEqualPowerCrossfade(previousTail, currentHead);
        
        // Build the final audio: crossfaded region + rest of current chunk (minus the tail we'll save)
        const restOfCurrent = combined.slice(CROSSFADE_BYTES, combined.length - CROSSFADE_BYTES);
        audioToEncode = new Uint8Array(crossfaded.length + restOfCurrent.length);
        audioToEncode.set(crossfaded, 0);
        audioToEncode.set(restOfCurrent, crossfaded.length);
        
        logDebug('crossfade_applied', {
          previousTailBytes: previousTail.length,
          crossfadeBytes: CROSSFADE_BYTES,
          resultBytes: audioToEncode.length,
        });
      } else {
        // No previous tail or chunk too small - use as-is (minus tail to save)
        if (combined.length > CROSSFADE_BYTES) {
          audioToEncode = combined.slice(0, combined.length - CROSSFADE_BYTES);
        } else {
          audioToEncode = combined;
        }
        
        if (!hasPreviousTail) {
          logDebug('crossfade_skipped', { reason: 'no_previous_tail' });
        }
      }
      
      // Save the tail of current chunk for crossfading with next chunk
      if (combined.length >= CROSSFADE_BYTES) {
        previousAudioTailRef.current = combined.slice(combined.length - CROSSFADE_BYTES);
      }

      // Create WAV data with header
      const wavHeader = createWavHeader(audioToEncode.length);
      const wavData = new Uint8Array(wavHeader.length + audioToEncode.length);
      wavData.set(wavHeader, 0);
      wavData.set(audioToEncode, wavHeader.length);
      logDebug('wav_data_created', { wavBytes: wavData.length, audioBytes: audioToEncode.length });

      // Convert to base64 using custom encoder (no stack overflow)
      const base64Audio = uint8ArrayToBase64(wavData);
      const uri = `data:audio/wav;base64,${base64Audio}`;

      // Assign a unique ID to this sound for tracking
      const soundId = ++soundIdCounterRef.current;
      const expectedDurationMs = (audioToEncode.length / (AUDIO_CONFIG.sampleRate * AUDIO_CONFIG.channels * (AUDIO_CONFIG.bitsPerSample / 8))) * 1000;
      const crossfadeStartPosition = Math.max(0, expectedDurationMs - VOLUME_CROSSFADE_MS);
      let crossfadeTriggered = false;
      
      // Create sound object with position tracking for crossfade
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 50 },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          
          // Check if we should start crossfade (approaching end of sound)
          if (status.positionMillis >= crossfadeStartPosition && 
              !crossfadeTriggered && 
              !crossfadeInProgressRef.current &&
              soundQueueRef.current.length > 0 &&
              currentSoundRef.current?.sound === sound) {
            crossfadeTriggered = true;
            logDebug('crossfade_trigger', {
              soundId,
              positionMs: status.positionMillis,
              crossfadeStartPosition,
              queueLength: soundQueueRef.current.length,
            });
            playNextInQueue(true);  // Start overlapping playback
          }
          
          if (status.didJustFinish) {
            const finishTime = Date.now();
            lastSoundFinishTimeRef.current = finishTime;
            
            logInfo('sound_finished', {
              soundId,
              expectedDurationMs: Math.round(expectedDurationMs),
              actualDurationMs: lastSoundStartTimeRef.current ? finishTime - lastSoundStartTimeRef.current : 0,
              queueLengthAtFinish: soundQueueRef.current.length,
              crossfadeTriggered,
            });
            
            // Only play next if crossfade wasn't triggered (shouldn't happen in normal flow)
            if (!crossfadeTriggered && currentSoundRef.current?.sound === sound) {
              sound.unloadAsync().catch(() => {});
              currentSoundRef.current = null;
              playNextInQueue(false);
            } else if (!crossfadeInProgressRef.current) {
              // Clean up if we're the outgoing sound and crossfade is done
              sound.unloadAsync().catch(() => {});
            }
          }
        }
      );
      
      metricsRef.current.soundsCreated++;
      setMetrics({ ...metricsRef.current });
      logDebug('sound_created', { 
        soundId,
        soundsCreated: metricsRef.current.soundsCreated,
        expectedDurationMs: Math.round(expectedDurationMs),
        audioBytes: audioToEncode.length,
        crossfadeApplied: hasPreviousTail,
        crossfadeStartPosition: Math.round(crossfadeStartPosition),
      });

      // Add to queue with metadata
      const soundItem = { sound, durationMs: expectedDurationMs, soundId };
      soundQueueRef.current.push(soundItem);
      const queueSize = soundQueueRef.current.length;
      logDebug('sound_queued', { queueSize });

      // Start playing if nothing is currently playing
      if (!currentSoundRef.current && isPlayingRef.current) {
        // For initial playback, wait until we have enough sounds buffered
        if (!initialPlaybackStartedRef.current) {
          if (queueSize >= MIN_SOUNDS_BEFORE_PLAYBACK) {
            logInfo('initial_playback_starting', {
              queueSize,
              minRequired: MIN_SOUNDS_BEFORE_PLAYBACK,
            });
            initialPlaybackStartedRef.current = true;
            metricsRef.current.isAudioPlaying = true;
            setMetrics({ ...metricsRef.current });
            playNextInQueue(false);
          } else {
            logDebug('buffering_before_playback', {
              queueSize,
              minRequired: MIN_SOUNDS_BEFORE_PLAYBACK,
            });
          }
        } else {
          // Already started, play immediately
          playNextInQueue(false);
        }
      }
    } catch (error) {
      logError('audio_processing_error', { error: String(error) });
    } finally {
      processingRef.current = false;
    }
  }, [playNextInQueue]);

  // Handle incoming audio chunk from Socket.IO
  const handleAudioChunk = useCallback((data: { data: string }) => {
    if (!data.data) return;
    
    // Buffer audio chunk
    const audioData = base64ToUint8Array(data.data);
    const chunkSize = audioData.length;
    
    if (chunkSize > 0) {
      // Update metrics
      metricsRef.current.chunksReceived++;
      metricsRef.current.bytesReceived += chunkSize;
      metricsRef.current.lastChunkTimestamp = Date.now();
      
      audioBufferRef.current.push(audioData);

      // Combine multiple chunks into longer sounds to ensure sustainable playback
      // Wait for MIN_BYTES_PER_SOUND before creating a sound
      const totalBuffered = audioBufferRef.current.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );
      
      logDebug('chunk_received', {
        chunkSize,
        chunksReceived: metricsRef.current.chunksReceived,
        totalBuffered,
        threshold: MIN_BYTES_PER_SOUND,
      });
      
      if (totalBuffered >= MIN_BYTES_PER_SOUND && !processingRef.current) {
        logDebug('buffer_threshold_reached', { totalBuffered, threshold: MIN_BYTES_PER_SOUND });
        processAudioBuffer();
      }
      
      // Update state metrics periodically (every 10 chunks)
      if (metricsRef.current.chunksReceived % 10 === 0) {
        setMetrics({ ...metricsRef.current });
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
    logInfo('play_requested', { bookTitle: book.title });
    
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
      logInfo('socket_connecting', { url: SOCKET_IO_URL });
      const socket = io(SOCKET_IO_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      // Set up Socket.IO event listeners
      socket.on('connect', () => {
        logInfo('socket_connected');
      });

      socket.on('connect_error', (error: Error) => {
        logError('socket_connect_error', { error: error.message });
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Connection error',
        }));
      });

      socket.on('disconnect', (reason: string) => {
        logInfo('socket_disconnected', { reason });
        isPlayingRef.current = false;
      });

      socket.on('audio_chunk', handleAudioChunk);
      socket.on('status', handleStatus);

      socket.on('error', (data: { message: string }) => {
        logError('socket_error', { message: data.message });
        setState(prev => ({
          ...prev,
          status: 'error',
          error: data.message,
        }));
      });

      socket.on('session_stopped', () => {
        logInfo('session_stopped_event');
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
      logInfo('starting_session_api', { bookTitle: book.title });
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
      logInfo('session_created', { sessionId: session_id, promptCount: prompts.length });

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
          logInfo('session_joined', { sessionId: session_id });
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
      logError('play_error', { error: error instanceof Error ? error.message : String(error) });
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

    logInfo('pause_requested', { sessionId: state.session.sessionId });

    try {
      // Send pause command via REST API
      const response = await fetch(`${API_BASE_URL}/music/pause/${state.session.sessionId}`, {
        method: 'POST',
      });

      if (response.status === 404) {
        // Session no longer exists on server, reset state
        logWarn('session_not_found_on_pause', { sessionId: state.session.sessionId });
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
      metricsRef.current.isAudioPlaying = false;
      setMetrics({ ...metricsRef.current });
      setState(prev => ({ ...prev, status: 'paused' }));
      logInfo('paused');

      // Clear any ongoing crossfade
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
        crossfadeIntervalRef.current = null;
      }
      crossfadeInProgressRef.current = false;

      // Pause current sound
      if (currentSoundRef.current) {
        try {
          const status = await currentSoundRef.current.sound.getStatusAsync();
          if (status.isLoaded) {
            await currentSoundRef.current.sound.pauseAsync();
          }
        } catch (e) {
          // Ignore if sound not loaded
        }
      }

      // Pause outgoing sound if any
      if (outgoingSoundRef.current) {
        try {
          const status = await outgoingSoundRef.current.getStatusAsync();
          if (status.isLoaded) {
            await outgoingSoundRef.current.pauseAsync();
          }
        } catch (e) {
          // Ignore if sound not loaded
        }
      }
    } catch (error) {
      logError('pause_error', { error: String(error) });
    }
  }, [state.session, cleanup]);

  // Resume music
  const resume = useCallback(async () => {
    if (!state.session || !socketRef.current) return;

    logInfo('resume_requested', { sessionId: state.session.sessionId });

    try {
      // Send resume command via REST API
      const response = await fetch(`${API_BASE_URL}/music/resume/${state.session.sessionId}`, {
        method: 'POST',
      });

      if (response.status === 404) {
        // Session no longer exists on server, reset state
        logWarn('session_not_found_on_resume', { sessionId: state.session.sessionId });
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
      metricsRef.current.isAudioPlaying = true;
      setMetrics({ ...metricsRef.current });
      setState(prev => ({ ...prev, status: 'playing' }));
      logInfo('resumed');

      // Resume current sound or play next in queue
      if (currentSoundRef.current) {
        try {
          const status = await currentSoundRef.current.sound.getStatusAsync();
          if (status.isLoaded) {
            await currentSoundRef.current.sound.playAsync();
          }
        } catch (e) {
          // Ignore if sound not loaded
        }
      } else {
        playNextInQueue(false);
      }
    } catch (error) {
      logError('resume_error', { error: String(error) });
    }
  }, [state.session, playNextInQueue, cleanup]);

  // Stop music
  const stop = useCallback(async () => {
    if (state.session) {
      logInfo('stop_requested', { sessionId: state.session.sessionId });
      try {
        // Send stop command via REST API
        await fetch(`${API_BASE_URL}/music/stop/${state.session.sessionId}`, {
          method: 'POST',
        });
        logInfo('stop_api_called');
      } catch (error) {
        logError('stop_error', { error: String(error) });
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
    metrics,
    play,
    pause,
    resume,
    stop,
  };
}
