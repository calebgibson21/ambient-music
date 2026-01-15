# Ambient Music

A React Native mobile app that generates AI-powered ambient music to match the mood and themes of the book you're reading. Search millions of books via the Open Library API, build your reading list, and let the AI compose a unique soundtrack for your literary journey.

![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react)
![Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688?logo=fastapi)

## Features

- **Book Search** — Search millions of books via the Open Library API with filters for language, publication year, and sorting
- **AI-Generated Ambient Music** — Contextual music generation using Google's Lyria RealTime API that matches your book's mood and genre
- **Reading List** — Track books you're reading, want to read, or have finished with persistent local storage
- **Genre-Aware Soundtracks** — Intelligent mapping from book genres to musical moods (Horror → Dark Ambient, Romance → Piano Ballad, Sci-Fi → Synthwave, etc.)
- **Real-time Streaming** — Live audio streaming via Socket.IO with play/pause controls
- **Dark Theme** — Dark UI with purple accents designed for comfortable reading

## How It Works

1. **Search** for a book or browse by genre
2. **Tap** "Play Ambient Music" on any book
3. **Listen** as AI generates a unique ambient soundtrack based on the book's subjects, description, and mood
4. **Read** with perfectly matched background music

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        React Native App                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ BookSearch  │  │ ReadingList │  │      MusicPlayer        │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│         ▼                ▼                     ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    MusicContext                              │ │
│  │  (Global state: session, playback, Socket.IO connection)    │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                   REST API   │   Socket.IO
                   (session)  │   (audio stream)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Python Backend                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │  FastAPI    │  │   Socket.IO  │  │   Prompt Generator    │   │
│  │  REST API   │  │   Server     │  │   (Genre → Music)     │   │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬───────────┘   │
│         │                │                      │                │
│         ▼                ▼                      ▼                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Lyria Session Manager                          │ │
│  │      (Google Gemini API / Lyria RealTime)                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Expo CLI** (`npm install -g expo-cli`)
- **Google Gemini API Key** with Lyria RealTime access
- iOS Simulator, Android Emulator, or Expo Go app

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/yourusername/ambient-music.git
cd ambient-music
```

**2. Install frontend dependencies**

```bash
npm install
```

**3. Set up the backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**4. Configure environment variables**

Create a `.env` file in the `backend/` directory:

```env
GEMINI_API_KEY=your-gemini-api-key-here
```

### Running the App

**Start the backend server:**

```bash
cd backend
source venv/bin/activate
python main.py
```

The API will be available at `http://localhost:8000`.

**Start the frontend (in a new terminal):**

```bash
npm start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Press `w` for web browser
- Scan QR code with Expo Go for physical device

> **Note for physical devices:** Update `src/config.ts` with your computer's local IP address instead of `localhost`.

## Genre to Music Mapping

The AI generates contextually appropriate music based on book subjects:

| Book Genre | Music Style |
|------------|-------------|
| Horror, Gothic | Dark Ambient, Ominous Drone, Eerie |
| Romance | Piano Ballad, Emotional, Dreamy |
| Science Fiction | Synthpop, Electronic, Spacey |
| Fantasy | Orchestral, Ethereal, Epic |
| Mystery, Crime | Jazz Fusion, Noir, Atmospheric |
| History | Classical, Ambient, Timeless |
| Poetry | Indie Folk, Acoustic, Intimate |
| Philosophy | Meditation, Contemplative, Minimal |
| Adventure | Epic, Orchestral, Cinematic |
| Comedy | Playful, Jazzy, Upbeat |

## Project Structure

```
ambient-music/
├── App.tsx                 # Root component with navigation
├── src/
│   ├── components/
│   │   ├── BookSearch.tsx      # Search interface with filters
│   │   ├── BookDetailModal.tsx # Book details & music trigger
│   │   ├── MusicPlayer.tsx     # Floating audio player
│   │   ├── ReadingList.tsx     # Personal reading list
│   │   └── SearchFilters.tsx   # Filter controls
│   ├── context/
│   │   └── MusicContext.tsx    # Global music state
│   ├── hooks/
│   │   ├── useAmbientMusic.ts  # Music playback logic
│   │   ├── useBookSearch.ts    # Open Library API integration
│   │   ├── useReadingList.ts   # Local storage persistence
│   │   └── useDebounce.ts      # Input debouncing
│   ├── types/
│   │   └── book.ts             # TypeScript definitions
│   └── config.ts               # API configuration
├── backend/
│   ├── main.py                 # FastAPI + Socket.IO server
│   ├── lyria_client.py         # Lyria RealTime session management
│   ├── prompt_generator.py     # Genre → music prompt mapping
│   ├── logging_config.py       # Structured logging
│   └── requirements.txt        # Python dependencies
└── package.json
```

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/music/start` | Start a music session for a book |
| `POST` | `/music/stop/{session_id}` | Stop a music session |
| `POST` | `/music/pause/{session_id}` | Pause playback |
| `POST` | `/music/resume/{session_id}` | Resume playback |
| `GET` | `/music/status/{session_id}` | Get session status |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Server metrics & observability |

### Socket.IO Events

**Client → Server:**
- `join_session` — Join a music streaming session
- `leave_session` — Leave a session
- `pause` — Pause playback
- `resume` — Resume playback

**Server → Client:**
- `session_joined` — Confirmation with audio format info
- `audio_chunk` — Base64-encoded PCM16 audio data
- `status` — Playback status updates
- `session_stopped` — Session termination notice

### Audio Format

- **Format:** 16-bit PCM (raw audio)
- **Sample Rate:** 48kHz
- **Channels:** 2 (stereo)

## Tech Stack

### Frontend
- **React Native** 0.81 with **Expo** 54
- **React** 19 with TypeScript (strict mode)
- **expo-av** for audio playback
- **socket.io-client** for real-time streaming
- **@react-native-async-storage** for persistence

### Backend
- **Python** 3.11+
- **FastAPI** with async support
- **python-socketio** for real-time communication
- **google-genai** SDK for Lyria RealTime API

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Open Library](https://openlibrary.org/) for their free book data API
- [Google Gemini](https://deepmind.google/technologies/gemini/) for the Lyria RealTime music generation API
- The React Native and Expo teams for the excellent mobile development framework
