import { Platform } from 'react-native';

/**
 * Application configuration constants.
 */

// Backend API configuration
// - iOS Simulator & Web: localhost works
// - Android Emulator: 10.0.2.2 maps to host machine's localhost
// - Physical device: Use your computer's local IP (e.g., 192.168.x.x)
const getApiHost = (): string => {
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine
    return '10.0.2.2';
  }
  // iOS Simulator and web can use localhost
  return 'localhost';
};

export const API_BASE_URL = `http://${getApiHost()}:8000`;

// Socket.IO URL (uses the same base URL - Socket.IO handles transport)
export const SOCKET_IO_URL = API_BASE_URL;

// Audio configuration
export const AUDIO_CONFIG = {
  sampleRate: 48000,
  channels: 2,
  bitsPerSample: 16,
} as const;
