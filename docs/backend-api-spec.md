# Backend API specification

**Status:** implemented in [`backend/`](../backend/) (phase 1 participant endpoints and the phase 2 admin endpoints). The frontend still calls its mock layer; see §6 for the switch. Companion to [frontend-domain-model.md](frontend-domain-model.md); entity shapes are defined there and referenced here.

The backend is a Node/TypeScript HTTP API over MongoDB that the React frontend calls in place of its current mock layer ([`frontend/src/api/index.ts`](../frontend/src/api/index.ts)). The team chose TypeScript over the originally drafted Python so the frontend and backend share one language, one toolchain and, via [`shared/`](../shared/), one copy of the domain types and the scoring rule.

## 1. Stack and conventions

| Concern | Choice | Why |
|---|---|---|
| Framework | **Express 5** | Most widely known Node server; async handlers propagate errors to the one error handler |
| Mongo driver | **Mongoose** | Schema-typed documents that mirror `shared/types.ts`; the teammate's draft collections were also created with Mongoose |
| Validation | **Zod** schema for every request body and query (`backend/src/validation.ts`) | Rejects bad input before it touches the DB, with a per-field error list |
| Auth | Short-lived **JWT** (access token) in an `Authorization: Bearer` header | Stateless, works across Vercel (frontend) and a separate API host; no cookie/CORS complications |
| Passwords | `bcryptjs`, cost 10 | Standard |
| Shared code | `shared/types.ts`, `shared/survey.ts`, `shared/scoring.ts` | One definition of the wire types, the survey items and the calm-score rule |
| Hosting | Any container host (Render, Railway, Fly.io) or a small VM. **Not Vercel** (persistent Mongo connection) | |
| Database | MongoDB Atlas, database `walkingapp` | The team's existing cluster; see §3 for collection naming |

Run locally with `npm run dev` in `backend/` (see the README). Environment variables are documented in `backend/.env.example`.

**Base URL:** `https://api.<domain>/v1` (dev: `http://localhost:8000/v1`). Version prefix from day one so breaking changes can go to `/v2`.

**Content type:** JSON everywhere. Dates are ISO 8601 strings in UTC (`2026-09-05T08:15:00Z`). IDs are strings.

**CORS:** allow the Vercel production origin and `*.vercel.app` preview origins; allow `Authorization` and `Content-Type` headers.

### Error format

Every non-2xx response uses one shape:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Incorrect user ID or password." } }
```

`message` is safe to show to the user verbatim. `code` is stable and machine-readable. Standard codes:

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query fails schema. Include `details: [{ field, message }]` |
| 401 | `UNAUTHENTICATED` | Missing/expired/invalid token |
| 401 | `INVALID_CREDENTIALS` | Login failed (don't reveal which part) |
| 403 | `FORBIDDEN` | Valid token, wrong role, or accessing another participant's data |
| 404 | `NOT_FOUND` | |
| 409 | `CONFLICT` | e.g. duplicate walk id, access code already used |
| 500 | `INTERNAL` | Never leak stack traces |

### Auth model

- `POST /auth/login` returns an access token (JWT, ~24 h) containing `sub` (user id), `role`, and for participants `condition`.
- Every other endpoint requires `Authorization: Bearer <token>` unless marked public.
- **The server derives identity from the token, never from the request body.** A participant can only read/write their own walks; the `participantId` in a walk is set from the token, not accepted from the client.
- Refresh tokens are out of scope for phase 1; on 401 the frontend sends the user back to login.

## 2. Phase 1 — participant endpoints

These five endpoints replace the five functions in the mock API, one for one.

### 2.1 `POST /auth/login` (public)

Replaces `login(role, userId, password)`.

Request:
```json
{ "role": "participant", "userId": "AAA001", "password": "••••" }
```

`role` ∈ `participant | medical_professional | researcher`. The server checks the account actually has that role; logging in as the wrong role is `INVALID_CREDENTIALS`, not a hint.

Response `200`:
```json
{
  "token": "<jwt>",
  "expiresAt": "2026-09-06T08:15:00Z",
  "role": "participant",
  "participant": {
    "id": "AAA001",
    "displayName": "Participant AAA001",
    "condition": "A",
    "joinedAt": "2026-08-12T09:00:00Z"
  }
}
```

`participant` is `null` for non-participant roles.

Errors: `INVALID_CREDENTIALS`. Rate-limited to 20 requests per minute per IP (`429`); `/auth/access-code` has its own separate bucket. User IDs are matched case-insensitively (`demo` and `DEMO` are the same account).

### 2.2 `GET /me`

Returns the current user, same shape as the login response minus the token. Lets the frontend restore a session from a stored token on refresh.

### 2.3 `GET /me/walks`

Replaces `getWalkHistory(participantId)`. Participant only.

Query: `limit` (default 50, max 200), `before` (ISO date cursor for paging, optional).

Response `200`:
```json
{
  "walks": [ <WalkRecord>, ... ],
  "nextBefore": "2026-08-30T08:15:00Z"
}
```

Sorted newest first. `nextBefore` is `null` when there are no more. Each `WalkRecord` matches the domain model **plus** a server-computed `scores` object (see §4).

### 2.4 `POST /routes/generate`

Replaces `generateRoutes(duration)`. Participant only.

Request — the full `WalkPlan`, because real routing needs the locations and type, not just the duration:
```json
{
  "startLocation": "Home",
  "endLocation": "Home",
  "duration": 30,
  "routeType": "loop"
}
```

Response `200`:
```json
{ "routes": [ <RouteOption>, <RouteOption>, <RouteOption> ] }
```

Phase 1 returns the same three template routes the mock did (`backend/src/services/routeTemplates.ts`). Until routing is real only `duration` is required; the other plan fields are accepted and ignored, so the current frontend (which sends just the duration) works unchanged. When a map/routing provider or the landmark model is adopted this endpoint calls it server-side (keeps the provider API key off the client) and `RouteOption.path` changes to real geometry — see open question in the domain model. Always return exactly three options so the UI doesn't need to handle variable counts.

### 2.5 `GET /scripts`

Replaces `getScript(durationMinutes)`. Participant only.

Query: `duration` (15 | 30 | 45).

The **condition is taken from the token**, not the query, so a participant cannot request another arm's script.

Response `200`:
```json
{
  "condition": "A",
  "scriptVersion": 3,
  "segments": [ { "atSecond": 0, "title": "Welcome", "text": "..." }, ... ]
}
```

`atSecond` values are already scaled to the requested duration. `scriptVersion` identifies the exact text served (see §3, `conditions`), and the frontend passes it back when saving the walk.

### 2.6 `POST /me/walks`

Replaces `saveWalk(record)`. Participant only. Called once, from the post-survey screen; abandoned walks are never posted.

Request:
```json
{
  "clientId": "w-1757059200000",
  "date": "2026-09-05T08:15:00Z",
  "plan": { "startLocation": "Home", "endLocation": "Home", "duration": 30, "routeType": "loop" },
  "route": <RouteOption>,
  "preSurvey":  { "calm": 2, "tense": 3, "at_ease": 2, "worried": 3 },
  "postSurvey": { "calm": 3, "tense": 2, "at_ease": 3, "worried": 2 },
  "actualMinutes": 31,
  "scriptVersion": 3
}
```

Validation:
- `preSurvey` and `postSurvey` must both be present and contain exactly the active survey item keys, each 1–4.
- `duration` ∈ {15, 30, 45}; `routeType` ∈ the four known values; `actualMinutes` ≥ 1.
- `clientId` is the frontend's draft id; the server uses it as an **idempotency key** so a retried request doesn't create a duplicate (second attempt returns the existing record with `200`, not `409`).
- **Compatibility:** the current frontend posts its whole `WalkRecord` (`id`, `participantId`, `completed`, …). The server accepts `id` as an alias for `clientId` and ignores `participantId` and `completed`; identity always comes from the token. Unknown fields are dropped.
- `scriptVersion` is optional; when absent the condition's current version is recorded.
- `condition` is copied onto the walk from the **account** at save time (not from the token), so a reassignment after login is honoured.

Response `201` — the stored `WalkRecord` with server-assigned `id`, `participantId` (from token), `condition`, `completed: true`, `scriptVersion` and `scores`.

## 3. MongoDB collections

Documents mirror the domain model. Field names are camelCase to match the frontend exactly (no snake_case translation layer to maintain). Mongoose models live in `backend/src/models/`; indexes are declared there and synced on every server start (`syncIndexes`), so no manual index setup is needed.

**Naming.** All three collections live in the team's `walkingapp` database, alongside the draft collections for the later landmark-guided model (`users`, `walks`, `routes`, `landmarks`, `scriptsegments`, `audiofiles`, `voiceprofiles`, `firebaseusers`). To avoid colliding with those drafts, this API uses **`accounts`** (this spec's "users") and **`walkRecords`** (this spec's "walks"). Mongoose schemas for the draft collections are checked in under `backend/src/models/` (`User`, `Walk`, `Route`, `Landmark`, `ScriptSegment`, `AudioFile`, `VoiceProfile`, `SessionLog`, `FirebaseUser`) for the later phase, but no endpoint uses them and the server does not register them, so their indexes are not touched on startup.

### `accounts`

One document per login, all roles.

```jsonc
{
  "_id": "AAA001",                 // login user ID; participant IDs are AAA### style
  "role": "participant",           // participant | medical_professional | researcher
  "passwordHash": "...",           // null until the access code is redeemed
  "displayName": "Participant AAA001",
  "condition": "A",                // participants only; references conditions._id
  "accessCodeHash": "…sha256…",    // participants only; the code itself is never stored; null after redemption
  "accessCodeUsedAt": null,
  "joinedAt": "2026-08-12T09:00:00Z",
  "createdBy": "researcher01",     // admin who created the account
  "active": true
}
```

Indexes: `_id` (default), `{ role: 1 }`, `{ accessCodeHash: 1 }` unique, partial (only documents where it is a string; a sparse index would still index the many `null`s and collide).

### `walkRecords`

One document per completed walk. Surveys, plan and route are embedded — a walk is read as a unit and never partially updated.

```jsonc
{
  "_id": ObjectId,
  "clientId": "w-1757059200000",   // idempotency key from the frontend
  "participantId": "AAA001",
  "condition": "A",                // copied from the user at save time, so reassigning a participant later doesn't rewrite history
  "date": "2026-09-05T08:15:00Z",
  "plan": { ... },
  "route": { ... },
  "preSurvey": { ... },
  "postSurvey": { ... },
  "actualMinutes": 31,
  "scriptVersion": 3,
  "surveyVersion": 1,
  "completed": true,
  "createdAt": "2026-09-05T08:47:00Z"
}
```

Indexes: `{ participantId: 1, date: -1 }` (history query), `{ participantId: 1, clientId: 1 }` unique (idempotency), `{ condition: 1, date: -1 }` (dashboard).

Do **not** store computed scores here (see §4).

### `conditions`

Admin-defined experimental arms. Each holds its own script.

```jsonc
{
  "_id": "A",
  "name": "Condition A",
  "description": "Breathing-focused script",
  "voice": "Male",                 // TTS persona that reads the script; edited on the admin Settings screen
  "age": 30,                       // apparent age of the voice persona
  "scriptVersion": 3,
  "script": [                      // template; atFraction scaled to duration at request time
    { "atFraction": 0.00, "title": "Welcome", "text": "..." },
    { "atFraction": 0.06, "title": "Arriving", "text": "..." }
  ],
  "scriptHistory": [               // previous versions kept so scriptVersion on a walk is always resolvable
    { "scriptVersion": 2, "script": [ ... ], "retiredAt": "..." }
  ],
  "updatedAt": "...",
  "updatedBy": "researcher01"
}
```

Editing a script increments `scriptVersion` and pushes the old one to `scriptHistory`.

### `surveyItems` (optional)

Only if researchers must edit items without a code deploy. Otherwise keep items in code and record `surveyVersion` on each walk. Recommendation: **keep in code for phase 1**, bump `surveyVersion` if items ever change.

## 4. Derived scores

Per the domain model decision, scores are computed on the backend at read time and never stored.

Every `WalkRecord` the API returns includes:

```json
"scores": {
  "scoringVersion": 1,
  "pre":   { "calm": 8 },
  "post":  { "calm": 12 },
  "delta": { "calm": 4 }
}
```

`scoringVersion: 1` definition — for each survey: sum of positive items (`calm`, `at_ease`) plus reverse-scored negatives (`5 − score` for `tense`, `worried`). Range 4–16. It lives in one function, [`shared/scoring.ts`](../shared/scoring.ts), used by the walks endpoints, `GET /admin/stats` and the CSV export alike. When the frontend switches to the real API, delete the client-side copy in `History.tsx` (or import the shared one).

## 5. Phase 2 — admin / researcher endpoints

Implemented, because the admin dashboard (PR #2) already calls them. Require `role ∈ { medical_professional, researcher }`; a participant token gets `403`. List responses are wrapped in an object (`{ "participants": [...] }`, `{ "conditions": [...] }`, `{ "walks": [...] }`) so fields can be added later without a breaking change.

| Method & path | Purpose |
|---|---|
| `GET /admin/participants` | `{ participants: AdminParticipantItem[] }`, most recently joined first. Each item: `id`, `condition`, `status` (`Not started` / `Completed`; `In progress` is reserved), `walkCount`, `lastWalkAt`, `active`, plus `stressStart` / `stressEnd` labels for the "tense" item of the latest walk (kept for the current UI; prefer `scores` from the walks endpoints) |
| `POST /admin/participants` | Create a participant: body is `{ "condition": "A" }` only. Server assigns the next `AAA###` id and generates the access code. Returns `201 { participant, accessCode }`; the code is never returned again (only its hash is stored). `409` if the condition does not exist |
| `PATCH /admin/participants/{id}` | Body `{ condition?, active? }`. Change condition / deactivate (a deactivated participant can no longer log in) |
| `GET /admin/participants/{id}/walks` | A participant's walks (same shape as `/me/walks`) |
| `GET /admin/conditions` | `{ conditions: ConditionSetting[] }` (`id`, `name`, `voice`, `age`) |
| `PUT /admin/conditions` | Replace the whole settings list, as the admin Settings screen saves it (body: `ConditionSetting[]` or `{ conditions: [...] }`). New ids are created with the default script; existing ones keep their script; nothing is deleted because participants and walks reference conditions. `409` on duplicate ids |
| `PUT /admin/conditions/{id}` | Edit one condition: any of `name`, `voice`, `age`, `script`. Changing `script` pushes the old one to `scriptHistory` and bumps `scriptVersion`. Creates the condition (`201`) if the id is new and `name`, `voice`, `age` are all given |
| `GET /admin/walks` | `{ walks: WalkRecord[] }` across all participants, newest first, each with `condition` and `scores`. Feeds the client-side CSV until the UI uses `export.csv` |
| `GET /admin/stats` | `{ scoringVersion, totals: { participants, walks }, perCondition: [{ condition, name, participants, walks, meanPreCalm, meanPostCalm, meanDeltaCalm }] }` — feeds the dashboard |
| `GET /admin/export.csv` | `text/csv` download, one row per walk: participant id, condition, walk id, date, planned minutes, route type, route name, distance, actual minutes, completed, every raw survey answer pre/post, the three calm scores, `scoring_version`, `script_version`, `survey_version` |
| `POST /auth/access-code` (public) | Participant's first login. Body `{ userId, accessCode, password }` (password ≥ 8 chars). Verifies the code against the stored hash (case-insensitive), sets the password, clears the code, and returns the same body as `/auth/login`. A used, wrong or missing code is `INVALID_CREDENTIALS`. Backs the "Access with code" button |

## 6. Frontend migration checklist

The backend exists; the frontend change is confined to one file plus token handling:

1. Add `VITE_API_BASE_URL` to `frontend/.env` (and the Vercel project env). Dev value: `http://localhost:8000/v1`.
2. Rewrite each function in `frontend/src/api/index.ts` as a `fetch` to the matching endpoint; keep the function signatures so no component changes. Note the list envelopes: `GET /me/walks` → `.walks`, `GET /admin/participants` → `.participants`, `GET /admin/conditions` → `.conditions`, `GET /admin/walks` → `.walks`; `saveAdminConditions(list)` → `PUT /admin/conditions`.
3. Store the JWT in memory + `sessionStorage` inside `SessionContext`; attach it as `Authorization` in the API layer; on `401`, call `signOut()`.
4. Pass `scriptVersion` from `GET /scripts` through the `WalkDraft` to `POST /me/walks` (optional; the server defaults it).
5. Read `scores` from the API in `History.tsx` and delete `calmScore()`.
6. Point `frontend/src/types.ts` imports at `shared/types.ts` (identical shapes, plus `scores`) so the two sides cannot drift.
7. Delete `frontend/src/mock/data.ts` (or keep behind a `VITE_USE_MOCK=true` flag for offline demos — recommended, since the phone-frame demo is useful without a backend).

## 7. Open points

- **Token lifetime vs. walk length.** A 45-minute walk plus surveys must fit inside the token's life. 24 h is safe; don't go shorter than 2 h without refresh tokens.
- **Routing provider.** Decide before implementing `/routes/generate` for real. It changes `RouteOption.path`'s format and adds a server-side API key.
- **Where the calm-score rule is documented for the ethics/research protocol.** `shared/scoring.ts` should cite it.
- **Landmark model.** The draft collections for landmark-guided walks (routes with GeoJSON, landmarks, per-landmark script segments, audio files, voice profiles) coexist in `walkingapp`. When that phase starts, `POST /routes/generate` and `GET /scripts` are the integration points; `walkRecords` can gain a `landmarkEvents` array without a breaking change. Conditions' `voice`/`age` likely map onto `voiceprofiles`.
- **Collection rename.** `accounts` / `walkRecords` were chosen to avoid the draft `users` / `walks`. If the drafts are dropped or moved to another database, the team may rename to the spec's original names.
- **Backups / data retention** for a research dataset — Atlas snapshots are probably sufficient, but confirm with the research lead.
- **Health notes on participants.** The first admin UI draft (PR #2) had a free-text "clinical notes / contraindications" field per participant. It was removed before merge: participants are anonymised `AAA###` ids and storing clinical notes changes the data-protection and ethics posture of the trial. Do not add such a field to `accounts` until the research lead confirms it is covered by the protocol, and if it is, specify who can read it (probably `medical_professional` only) and whether it is excluded from exports.
