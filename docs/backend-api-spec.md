# Backend API specification

**Status:** implemented in [`backend/`](../backend/) and wired to the frontend. Companion to [frontend-domain-model.md](frontend-domain-model.md); entity shapes live in [`shared/types.ts`](../shared/types.ts), which both sides import.

The backend is a Node/TypeScript HTTP API over MongoDB. It is the **only** thing the React app talks to. Behind it sits an internal Python AI service ([`server/`](../server/)) that the API calls for routes, script generation and text-to-speech; the app never reaches that service and never holds the Google or OpenAI keys.

```
frontend ──HTTPS + JWT──▶ backend (Node, :8000) ──HTTP + X-Internal-Key──▶ server (Python, :8001)
                              │
                          MongoDB Atlas
```

## 1. Stack and conventions

| Concern | Choice | Why |
|---|---|---|
| Framework | **Express 5** | Async handlers propagate errors to the one error handler |
| Mongo driver | **Mongoose** | Schema-typed documents that mirror `shared/types.ts` |
| Validation | **Zod** schema for every request body and query (`backend/src/validation.ts`) | Rejects bad input before it touches the DB, with a per-field error list |
| Auth | Short-lived **JWT** (access token) in an `Authorization: Bearer` header | Stateless, works across Vercel (frontend) and a separate API host |
| Passwords | `bcryptjs`, cost 10 | Standard |
| Shared code | `shared/types.ts`, `shared/survey.ts`, `shared/scoring.ts` | One definition of the wire types, the survey items and the calm-score rule |
| AI service | FastAPI in `server/`, called through `backend/src/services/aiClient.ts` | Routes (Google Routes + Places), scripts (OpenAI), audio (Google Cloud Text-to-Speech). Internal only |
| Audio storage | mp3 files under `AUDIO_DIR/<preparationId>/<index>.mp3`, streamed by the API | Simple, no extra service; a Docker volume in Compose |
| Hosting | One host running `docker compose up api ai` | The AI service must not be publicly reachable |
| Database | MongoDB Atlas, database `walkingapp` | The team's existing cluster |

**Base URL:** `https://api.<domain>/v1` (dev: `http://localhost:8000/v1`).

**Content type:** JSON everywhere except audio (`audio/mpeg`) and the CSV export. Dates are ISO 8601 strings in UTC. IDs are strings.

**CORS:** allow the Vercel production origin and `*.vercel.app` preview origins; allow `Authorization` and `Content-Type` headers.

### Error format

Every non-2xx response uses one shape:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Incorrect user ID or password." } }
```

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query fails schema (`details: [{ field, message }]`), or an address could not be found |
| 401 | `UNAUTHENTICATED` | Missing/expired/invalid token. The app signs out on this |
| 401 | `INVALID_CREDENTIALS` | Login or access-code failure (never says which part) |
| 403 | `FORBIDDEN` | Valid token, wrong role, or another participant's data |
| 404 | `NOT_FOUND` | |
| 409 | `CONFLICT` | e.g. duplicate condition id, saving a walk whose preparation is not ready |
| 410 | `NOT_FOUND` | Audio for a preparation was purged; prepare again |
| 502 | `AI_SERVICE` | The AI service failed or is unreachable |
| 500 | `INTERNAL` | Never leaks stack traces |

### Auth model

- `POST /auth/login` returns an access token (JWT, 24 h) containing `sub` (user id), `role`, and for participants `condition`.
- Every other endpoint requires `Authorization: Bearer <token>` unless marked public.
- **The server derives identity from the token, never from the request body.** A participant can only read/write their own walks and preparations.
- On 401 the app drops the session and returns to login. Refresh tokens are out of scope.

## 2. Participant endpoints

### 2.1 `POST /auth/login` (public)

Body `{ role, userId, password }`, `role` ∈ `participant | medical_professional | researcher`. Wrong role is `INVALID_CREDENTIALS`, not a hint. Rate-limited to 20/min per IP. User IDs are matched case-insensitively.

Response `200`: `{ token, expiresAt, role, participant }` (`participant` is `null` for admin roles).

### 2.2 `POST /auth/access-code` (public)

A participant's first login. Body `{ userId, accessCode, password }` (password ≥ 8). Verifies the code against the stored hash, sets the password, clears the code, returns the same body as `/auth/login`. A used, wrong or missing code is `INVALID_CREDENTIALS`. Own rate-limit bucket.

### 2.3 `GET /me`

Current user, same shape as the login response minus the token. Used to validate a stored token on app load.

### 2.4 `GET /me/walks`

Participant only. Query `limit` (default 50, max 200), `before` (ISO cursor). Response `{ walks: WalkRecord[], nextBefore }`, newest first. Each `WalkRecord` carries server-computed `scores` (§4) and the `script` that was read (§3).

### 2.5 `POST /routes/generate`

Participant only. Body: the full `WalkPlan` (`startLocation`, optional `startCoordinates`, `endLocation`, `duration`, `routeType`). The API asks the AI service to geocode the addresses (or use the coordinates), compute the direct walking route, and find parks along it whose detour still fits the duration.

Response `200`: `{ routes: RouteOption[] }`. The first option is always the direct walk; up to two more are detours via a park (`park` set), each with real geometry in `mapPath` (`[lat, lon]` points), a 0–100 `path` for the fallback drawing, and `origin`/`destination` coordinates the script generator needs later.

An address Google cannot find comes back as `400 VALIDATION_ERROR` with the Places message.

### 2.6 `POST /me/walks/prepare`

Participant only. Body `{ plan, route }` (the chosen `RouteOption`, echoed back unchanged). Creates a **walk preparation** and starts generating in the background:

1. `generating_script`: the AI service writes a meditation for this walk (route, weather, elevation, park or not, time budget). The text is split into three sections (focused attention → compassion → closing, 20/40/40 of the walk) and then into short spoken segments, each given an `atSecond`.
2. `generating_audio`: one mp3 per segment from the AI service, using the **voice of the participant's condition** (`voice`/`age` → a Google Cloud TTS voice name, speaking rate and pitch, see `backend/src/services/voice.ts`). `progress.done/total` counts files.
3. `ready` or `failed` (with `error`).

Response `202`: `{ preparation: WalkPreparation }` with `status: "pending"`. Poll:

### 2.7 `GET /me/walks/prepare/{id}`

`{ preparation }` with `status`, `progress`, `error` and, once `ready`, `script` (a `GeneratedScript`: `model`, `promptVersion`, `context`, `voice`, `segments[]`, `rawText`). Another participant's preparation is `404`.

### 2.8 `GET /me/walks/prepare/{id}/audio/{index}`

The mp3 for one segment (`audio/mpeg`). The app downloads every segment with its token before the walk starts so playback does not depend on the network. `410` if the file has been purged.

### 2.9 `POST /me/walks`

Participant only, called once from the post-survey screen; abandoned walks are never posted.

Body `{ clientId, date, plan, route, preSurvey, postSurvey, actualMinutes, preparationId }`.

- Both surveys must contain exactly the active survey items, each 1–4.
- `clientId` is an idempotency key: a retry returns the existing record with `200`.
- `preparationId` must be one of the participant's own `ready` preparations; the stored `script` is copied onto the walk. Otherwise `409`.
- `condition` is copied from the **account** at save time.

Response `201`: the stored `WalkRecord` with `id`, `condition`, `script`, `scores`.

## 3. MongoDB collections

Field names are camelCase to match the frontend exactly. Mongoose models live in `backend/src/models/`; indexes are synced on every server start.

### `accounts`

One document per login, all roles. Participants hold **no personal or clinical data**.

```jsonc
{
  "_id": "AAA001",                 // login user ID; participant IDs are AAA### style
  "role": "participant",
  "passwordHash": "...",           // null until the access code is redeemed
  "displayName": "Participant AAA001",
  "condition": "A",                // participants only; references conditions._id
  "accessCodeHash": "…sha256…",    // null after redemption
  "accessCodeUsedAt": null,
  "joinedAt": "2026-08-12T09:00:00Z",
  "createdBy": "researcher01",
  "active": true
}
```

Indexes: `{ role: 1 }`, `{ accessCodeHash: 1 }` unique partial.

### `conditions`

Admin-defined experimental arms. **A condition changes only the voice.** There is no script field: scripts are generated per walk (decision 2026-09-13, "AI-generated walk only, never a fixed script").

```jsonc
{ "_id": "A", "name": "Condition A", "voice": "Male", "age": 30, "updatedAt": "...", "updatedBy": "researcher01" }
```

`voice` is `Male | Female | Neutral` or a Google Cloud TTS voice name (e.g. `en-US-Neural2-J`); `age` shapes the speaking rate and pitch.

### `walkPreparations`

One per `POST /me/walks/prepare`. `{ participantId, condition, plan, route, context, status, progress, error, script, createdAt, updatedAt }`. Audio for it lives on disk under `AUDIO_DIR/<_id>/`. Anything still generating 30 min after its last update is marked `failed` on API start. Indexes: `{ participantId, createdAt }`, `{ status, updatedAt }`.

### `walkRecords`

One document per completed walk. Surveys, plan, route and **the generated script** are embedded, so the record is self-contained for analysis.

```jsonc
{
  "_id": ObjectId,
  "clientId": "w-1757059200000",
  "participantId": "AAA001",
  "condition": "A",
  "date": "2026-09-05T08:15:00Z",
  "plan": { "startLocation": "...", "endLocation": "...", "duration": 30, "routeType": "loop" },
  "route": { "id": "park-…", "name": "Via University Square", "mapPath": [[lat, lon], …], "park": { "name": "...", "lat": 0, "lon": 0 }, … },
  "preSurvey": { "calm": 2, "tense": 3, "at_ease": 2, "worried": 3 },
  "postSurvey": { "calm": 3, "tense": 2, "at_ease": 3, "worried": 2 },
  "actualMinutes": 31,
  "preparationId": ObjectId,
  "script": {
    "generator": "ai", "model": "gpt-4.1-mini", "promptVersion": 1,
    "context": "A 30-minute walking meditation for stress regulation …",
    "voice": { "voiceName": "en-US-Neural2-D", "languageCode": "en-US", "speakingRate": 0.9, "pitch": 0 },
    "segments": [ { "atSecond": 0, "section": "focused_attention", "title": "Focused attention 1/3", "text": "...", "audioIndex": 0 }, … ],
    "rawText": "[FOCUSED_ATTENTION]\n…"
  },
  "surveyVersion": 1,
  "completed": true,
  "createdAt": "2026-09-05T08:47:00Z"
}
```

Indexes: `{ participantId: 1, date: -1 }`, `{ participantId: 1, clientId: 1 }` unique, `{ condition: 1, date: -1 }`. Do **not** store computed scores here (§4).

## 4. Derived scores

Scores are computed on the backend at read time and never stored. Every `WalkRecord` the API returns includes `scores: { scoringVersion, pre: { calm }, post: { calm } | null, delta: { calm } | null }`.

`scoringVersion: 1`: for each survey, the sum of positive items (`calm`, `at_ease`) plus reverse-scored negatives (`5 − score` for `tense`, `worried`). Range 4–16. One function, [`shared/scoring.ts`](../shared/scoring.ts), used by the walks endpoints, `GET /admin/stats`, the participant list and the CSV export. The frontend only displays it.

## 5. Admin / researcher endpoints

Require `role ∈ { medical_professional, researcher }`; a participant token gets `403`. List responses are wrapped in an object.

| Method & path | Purpose |
|---|---|
| `GET /admin/participants` | `{ participants: AdminParticipantItem[] }`, most recently joined first: `id`, `condition`, `status`, `walkCount`, `lastWalkAt`, `latestScores` (scores of the latest walk or `null`), `active` |
| `POST /admin/participants` | Body `{ condition }`. Server assigns the next `AAA###` id and the access code; returns `201 { participant, accessCode }`, the code exactly once |
| `PATCH /admin/participants/{id}` | Body `{ condition?, active? }` |
| `GET /admin/participants/{id}/walks` | A participant's walks |
| `GET /admin/conditions` | `{ conditions: ConditionSetting[] }` (`id`, `name`, `voice`, `age`) |
| `PUT /admin/conditions` | Replace the whole settings list. Nothing is deleted because participants and walks reference conditions. `409` on duplicate ids |
| `PUT /admin/conditions/{id}` | Edit `name`, `voice`, `age`. **There is no way to upload or edit a script.** Unknown fields are dropped |
| `GET /admin/walks` | Every walk, newest first, with `condition`, `scores` and `script` |
| `GET /admin/stats` | `{ scoringVersion, totals, perCondition: [{ condition, name, participants, walks, meanPreCalm, meanPostCalm, meanDeltaCalm }] }` |
| `GET /admin/export.csv` | One row per walk: ids, dates, plan, route (incl. `via_park`), raw answers pre/post, the three calm scores, `scoring_version`, `survey_version`, `script_model`, `script_prompt_version`, `script_voice`, `script_word_count`, `script_text` |

## 6. AI service contract (internal)

`server/main.py`. Every call except `/health` must carry `X-Internal-Key` when `INTERNAL_KEY` is set (mirror of `AI_INTERNAL_KEY` in `backend/.env`).

| Method & path | Body → response |
|---|---|
| `GET /health` | `{ status, tts: ready \| disabled \| unavailable }` |
| `POST /route/generate-from-text` | `{ start_location, start_coordinates?, end_location, total_travel_time (s), park_polylines }` → `{ origin, destination, baseline: { duration_s, distance_m, polyline }, parks: [{ park, added_s, slack_s, route? }] }` |
| `POST /script/generate` | `{ source, destination, total_walking_time, context, park?, park_timing? }` → `{ script, model, prompt_version }` |
| `POST /tts` | `{ text, language_code, voice_name, speaking_rate, pitch }` → `audio/mpeg` bytes (Google Cloud Text-to-Speech) |

## 7. Open points

- **Cloud TTS quota.** The Neural2 free tier is 1 million characters/month; a full trial's worth of 30-45 minute walks could approach that. Watch usage in Google Cloud Console and budget-alert before the trial starts.
- **Audio retention.** mp3 files are kept per preparation. Decide whether audio is research data (keep with backups) or disposable (purge after N days; the walk keeps the text either way).
- **Weather and elevation** enrich the prompt when the Google Weather / Elevation APIs are enabled on the key; they degrade gracefully to "unknown" otherwise.
- **Backups / data retention** for a research dataset: Atlas snapshots are probably sufficient, confirm with the research lead.
- **Health notes on participants.** Deliberately absent (anonymised `AAA###` ids). Do not add such a field until the research lead confirms it is covered by the protocol.
- **Landmark model.** The draft Mongoose schemas (`User`, `Walk`, `Route`, `Landmark`, …) in `backend/src/models/` are unused and unregistered. Delete or revive when that phase is decided.
