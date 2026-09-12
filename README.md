# IT-Project — Walking Meditation

A guided walking-meditation app for a stress regulation trial. Participants check in, plan a walk, get a real route, and follow a meditation that is **written by AI for that exact walk** and read aloud in a server-generated voice. They check in again at the end. Researchers view and export the collected records.

## Architecture

```
 phone / browser                 one front door                    internal only
┌──────────────┐  HTTPS + JWT  ┌──────────────────┐  HTTP + key  ┌────────────────────────┐
│  frontend/   │ ────────────▶ │  backend/ (Node) │ ───────────▶ │  server/ (Python, AI)  │
│  React SPA   │               │  auth, walks,    │              │  Google routes, OpenAI │
└──────────────┘               │  admin, audio    │              │  script, Qwen3 TTS     │
                               └────────┬─────────┘              └────────────────────────┘
                                        │ Mongoose
                                   MongoDB Atlas
```

- The **app talks only to the Node API**. It never sees the Google or OpenAI keys and never calls the Python service.
- The **Node API** owns identity (JWT), participants, conditions, walk records, the researcher dashboard and CSV export. When a participant confirms a route it asks the AI service for a script and then for one audio clip per script segment, stores them, and streams the audio to the app.
- The **Python AI service** is a private helper with three capabilities: real walking routes (with park detours), an AI-written meditation script for one walk, and text-to-speech. It is not published outside the Compose network / host.
- **Conditions** select the voice (and its apparent age) that reads the script. There is deliberately no fixed script anywhere: every walk gets a new one, and the exact text is stored on the walk record for the research analysis.

| Folder | What |
|---|---|
| `frontend/` | React + TypeScript mobile web app (Vite, Tailwind, React Router, Leaflet) |
| `backend/` | Node + TypeScript API (Express, Mongoose, Zod, JWT) over MongoDB Atlas, port 8000 |
| `server/` | Python FastAPI AI service (Google Maps Platform, OpenAI, Qwen3-TTS), port 8001, internal |
| `shared/` | Domain types, survey items and the calm-score rule, imported by both frontend and backend |
| `docs/` | [backend-api-spec.md](docs/backend-api-spec.md), [frontend-domain-model.md](docs/frontend-domain-model.md) |
| `docker-compose.yml` | Runs api + ai (+ an optional local Mongo) as one unit |

## Running everything locally

Requires Node.js 20+, Python 3.11+ with ffmpeg on PATH (for the AI service), and either Docker (local Mongo) or access to the team's Atlas cluster.

### 1. AI service (`server/`)

```bash
cd server
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # GOOGLE_MAPS_API_KEY, OPENAI_API_KEY
uvicorn main:app --port 8001 --reload
```

The first start downloads the ~1.2 GB TTS model. Set `TTS_ENABLED=false` in `server/.env` to skip it while working on routes or scripts (audio generation then fails with 503 and the app shows an error at the Prepare step). `GET /health` reports `tts: ready | loading | disabled | unavailable`.

### 2. API (`backend/`)

```bash
cd backend
cp .env.example .env     # MONGODB_URI (Atlas, or mongodb://localhost:27017 with `docker compose up mongo`), JWT_SECRET
npm install
npm run seed             # idempotent: conditions A/B and the dev logins below
npm run dev              # http://localhost:8000/v1
```

`GET /v1/health` reports the database connection. On start the API logs whether the AI service is reachable.

### 3. App (`frontend/`)

```bash
cd frontend
cp .env.example .env     # VITE_API_BASE_URL=http://localhost:8000/v1
npm install
npm run dev
```

| URL | What you get |
|---|---|
| <http://localhost:5173> | The app on its own, as on a phone (use DevTools device emulation) |
| <http://localhost:5173/phone.html> | The app inside an iPhone-sized frame, with a toggle to a desktop window, for demos |

Dev logins created by `npm run seed` (only shown in dev builds):

| Role | User ID | Password | Lands on |
|---|---|---|---|
| Participant | `demo` | `demo` | Home → walk flow |
| Research admin | `admin` | `admin` | Admin dashboard (`/admin`) |
| Medical professional | `doctor` | `doctor` | Admin dashboard (`/admin`) |

A new participant is created from the admin dashboard, which shows a single-use access code once. The participant uses **Access with code** on the landing screen to set their password.

### Or with Docker Compose

```bash
docker compose up --build            # api + ai + local mongo (point backend/.env at mongodb://mongo:27017)
docker compose up --build api ai     # api + ai against Atlas
```

Only the API port (8000) is published; the AI service is reachable solely from the api container. Generated audio and the TTS model cache persist in named volumes.

## The walk flow

1. **Pre-survey** → **Plan** (start, end, 15/30/45 min, route type).
2. **Choose route**: `POST /routes/generate` returns a direct route plus up to two detours through a park that still fit the time.
3. **Prepare**: `POST /me/walks/prepare` starts generation; the app polls `GET /me/walks/prepare/{id}` while the server writes the script (OpenAI) and renders each segment to mp3 (Qwen3-TTS, voice from the participant's condition). When ready the app downloads the clips so the walk does not depend on the network.
4. **Walk**: segments play at their scheduled second, queued so they never overlap.
5. **Post-survey** → `POST /me/walks` stores the walk with the exact script that was read.

Script generation plus audio takes a few minutes on CPU (much faster on a GPU). The Prepare screen keeps the participant informed and offers a retry if anything fails.

## Deploying

- **Frontend**: Vercel, Root Directory `frontend`, env `VITE_API_BASE_URL=https://<api-host>/v1`. `frontend/vercel.json` handles SPA routes.
- **API + AI service**: one host running `docker compose up api ai` (a VM with a GPU makes audio generation fast; the existing AWS EC2 notes are in `server/READList/`). Set `AI_INTERNAL_KEY` in `backend/.env` and the same value as `INTERNAL_KEY` in `server/.env` so nothing but the API can call the AI service. Put the API behind nginx/TLS and allow the Vercel origin in `CORS_ORIGINS`.

## Secrets

Never commit `.env` files (all three folders ignore them; commit the `.env.example` files instead). A Google Maps key was committed on an earlier branch and must be treated as leaked: rotate it in Google Cloud Console.

## Notes

- Scores (the calm score shown in the app and in exports) are computed by the API from the raw answers and never stored; the rule lives in `shared/scoring.ts`.
- The CSV export (`GET /admin/export.csv`) includes every raw survey answer, the derived scores, and the full script text for each walk.
- The Mongoose schemas for an earlier landmark-guided design (`User`, `Walk`, `Route`, `Landmark`, …) remain in `backend/src/models/` but are not registered or used.
