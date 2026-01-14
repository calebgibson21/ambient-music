# Ambient Music Backend

Python backend server for streaming AI-generated ambient music based on book themes using Google's Lyria RealTime API.

## Setup

1. Create a virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or create a `.env` file in the backend directory:
```
GEMINI_API_KEY=your-api-key-here
```

## Running the Server

```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at `http://localhost:8000`.

## API Endpoints

### REST Endpoints

- `POST /music/start` - Start a music session for a book
  - Body: `{ "book": { "title": string, "authors": string[], "subjects": string[], "description": string } }`
  - Returns: `{ "session_id": string, "websocket_url": string, "prompts": array }`

- `POST /music/stop/{session_id}` - Stop a music session

- `POST /music/pause/{session_id}` - Pause a music session

- `POST /music/resume/{session_id}` - Resume a paused session

- `GET /music/status/{session_id}` - Get session status

- `GET /health` - Health check endpoint

### WebSocket Endpoint

- `WS /music/stream/{session_id}` - Stream audio chunks from an active session

  Messages from server:
  - `{ "type": "status", "is_playing": boolean, "sample_rate": 48000, "channels": 2, "format": "pcm16" }`
  - `{ "type": "audio", "data": "<base64 encoded PCM16 audio>" }`

  Messages from client:
  - `{ "type": "pause" }`
  - `{ "type": "resume" }`
  - `{ "type": "ping" }`

## Audio Format

- Format: 16-bit PCM (raw audio)
- Sample Rate: 48kHz
- Channels: 2 (stereo)

## Genre to Music Mapping

The backend automatically generates music prompts based on book subjects:

| Book Genre | Music Mood |
|------------|------------|
| Horror, Thriller | Dark Ambient, Ominous, Unsettling |
| Romance | Piano Ballad, Emotional, Dreamy |
| Science Fiction | Synthpop, Electronic, Experimental |
| Fantasy | Orchestral, Ethereal, Epic |
| Mystery | Jazz Fusion, Atmospheric, Noir |
| History | Classical, Ambient, Timeless |
| Poetry | Indie Folk, Acoustic, Chill |
