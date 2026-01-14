# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native mobile app built with Expo that provides book search/filtering via the Open Library API, with AI-generated ambient music that matches book themes using Google's Lyria RealTime API.

## Development Commands

```bash
# Frontend (React Native)
npm start          # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in web browser

# Backend (Python)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
GEMINI_API_KEY=your-key python main.py
```

No test or lint scripts are currently configured.

## Architecture

**Stack:** 
- Frontend: React 19 + React Native 0.81 + Expo 54 + TypeScript (strict mode)
- Backend: Python 3 + FastAPI + google-genai (Lyria RealTime)

**Frontend Structure:**
- `App.tsx` - Root component with MusicProvider context
- `src/components/` - UI components (BookSearch, MusicPlayer, ReadingList)
- `src/hooks/` - Data/state hooks (useBookSearch, useAmbientMusic, useDebounce)
- `src/context/` - React contexts (MusicContext for global music state)
- `src/types/book.ts` - TypeScript types and constants
- `src/config.ts` - API configuration constants

**Backend Structure (`backend/`):**
- `main.py` - FastAPI app with REST + WebSocket endpoints
- `lyria_client.py` - Lyria RealTime session management
- `prompt_generator.py` - Maps book genres to music prompts

**API Integration:** 
- Open Library API (no auth) for book data
- Google Gemini API (Lyria RealTime) for music generation via Python backend

**Music Flow:**
1. User taps "Play Ambient Music" on a book
2. Frontend sends book metadata to backend (`POST /music/start`)
3. Backend generates prompts from subjects (e.g., "Horror" → "Dark Ambient, Ominous")
4. Backend streams audio chunks via WebSocket to frontend
5. Frontend plays audio using expo-av

**Key Patterns:**
- Custom hooks for all data fetching with 400ms debouncing
- MusicContext provides global music state across components
- WebSocket streaming for real-time audio delivery
- Genre-to-mood mapping for contextual music generation
- Dark theme with purple accent (#A78BFA)

**Dual UI Modes:** Search mode (text query with filters) and Browse mode (genre-based exploration) are mutually exclusive.
