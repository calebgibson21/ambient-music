import React, { createContext, useContext, ReactNode } from 'react';
import { useAmbientMusic, MusicStatus } from '../hooks/useAmbientMusic';
import { Book } from '../types/book';

interface MusicContextValue {
  status: MusicStatus;
  currentBook: Book | null;
  prompts: Array<{ text: string; weight: number }>;
  error: string | null;
  play: (book: Book) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

const MusicContext = createContext<MusicContextValue | null>(null);

interface MusicProviderProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the app to provide music controls globally.
 */
export function MusicProvider({ children }: MusicProviderProps) {
  const music = useAmbientMusic();

  return (
    <MusicContext.Provider value={music}>
      {children}
    </MusicContext.Provider>
  );
}

/**
 * Hook to access music controls from any component.
 */
export function useMusic(): MusicContextValue {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}
