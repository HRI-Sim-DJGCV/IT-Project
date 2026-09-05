# Backend API specification (draft)

**Status:** draft, not implemented. Companion to [frontend-domain-model.md](frontend-domain-model.md); entity shapes are defined there and referenced here.

The backend is a Python HTTP API over MongoDB that the React frontend calls in place of its current mock layer ([`frontend/src/api/index.ts`](../frontend/src/api/index.ts)). Phase 1 covers everything the participant app needs. Phase 2 (admin/researcher) is sketched so the data model doesn't paint us into a corner, but is not required for the first backend release.

## 1. Stack and conventions

| Concern | Recommendation | Why |
|---|---|---|
| Framework | **FastAPI** | Async, typed request/response models via Pydantic, auto-generated OpenAPI docs at `/docs` — the frontend team can read the contract without this file |
| Mongo driver | **Motor** (async) via **Beanie** ODM, or Motor directly | Beanie gives Pydantic-typed documents that mirror `types.ts` closely |
| Auth | Short-lived **JWT** (access token) in an `Authorization: Bearer` header | Stateless, works across Vercel (frontend) and a separate API host; no cookie/CORS complications |
| Passwords | `bcrypt` via `passlib` | Standard |
| Validation | Pydantic models for every request and response | Rejects bad input before it touches the DB |
| Hosting | Any container host (Render, Railway, Fly.io) or a small VM. **Not Vercel** — Vercel's Python functions are fine for tiny handlers but awkward for a persistent Mongo connection | |
| Database | MongoDB Atlas free tier | Managed, has a free tier, IP allow-list |

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

Errors: `INVALID_CREDENTIALS`. Rate-limit by user ID + IP (e.g. 10/min) to slow guessing.

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

Phase 1 may return the same three template routes the mock does. When a map/routing provider is chosen this endpoint calls it server-side (keeps the provider API key off the client) and `RouteOption.path` changes to real geometry — see open question in the domain model. Always return exactly three options so the UI doesn't need to handle variable counts.

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

Response `201` — the stored `WalkRecord` with server-assigned `id`, `participantId` (from token), `completed: true`, and `scores`.

## 3. MongoDB collections

Collection names are plural, documents mirror the domain model. Field names are camelCase to match the frontend exactly (no snake_case translation layer to maintain).

### `users`

One document per login, all roles.

```jsonc
{
  "_id": "AAA001",                 // login user ID; participant IDs are AAA### style
  "role": "participant",           // participant | medical_professional | researcher
  "passwordHash": "...",
  "displayName": "Participant AAA001",
  "condition": "A",                // participants only; references conditions._id
  "accessCode": "K7P2-QX9M",       // participants only; issued by admin, cleared on first use
  "accessCodeUsedAt": null,
  "joinedAt": "2026-08-12T09:00:00Z",
  "createdBy": "researcher01",     // admin who created the account
  "active": true
}
```

Indexes: `_id` (default), `{ role: 1 }`, `{ accessCode: 1 }` unique sparse.

### `walks`

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

`scoringVersion: 1` definition — for each survey: sum of positive items (`calm`, `at_ease`) plus reverse-scored negatives (`5 − score` for `tense`, `worried`). Range 4–16. Put this in one function (`scoring.py`) used by the walks endpoints and the CSV export alike. When the frontend switches to the real API, delete the client-side copy in `History.tsx`.

## 5. Phase 2 — admin / researcher endpoints (sketch)

Require `role ∈ { medical_professional, researcher }`. Not needed for the first backend release; listed so `users` and `conditions` are designed with them in mind.

| Method & path | Purpose |
|---|---|
| `GET /admin/participants` | List participants with condition, join date, walk count, last walk |
| `POST /admin/participants` | Create a participant: assigns next `AAA###` id, condition, and generates an access code. Returns the code once |
| `PATCH /admin/participants/{id}` | Change condition / deactivate |
| `GET /admin/participants/{id}/walks` | A participant's walks (same shape as `/me/walks`) |
| `GET /admin/conditions` · `PUT /admin/conditions/{id}` | Read/edit conditions and their scripts (bumps `scriptVersion`) |
| `GET /admin/stats` | Counts per condition, mean pre/post/delta per condition — feeds the dashboard |
| `GET /admin/export.csv` | One row per walk: participant id, condition, date, duration, distance, actual minutes, every raw survey answer pre/post, scores, `scriptVersion`, `surveyVersion` |
| `POST /auth/access-code` (public) | Participant's first login: exchange an access code for a token and set a password. Backs the "Access with code" button |

## 6. Frontend migration checklist

When the backend exists, the frontend change is confined to one file plus token handling:

1. Add `VITE_API_BASE_URL` to `frontend/.env` (and the Vercel project env).
2. Rewrite each function in `frontend/src/api/index.ts` as a `fetch` to the matching endpoint; keep the function signatures so no component changes.
3. Store the JWT in memory + `sessionStorage` inside `SessionContext`; attach it as `Authorization` in the API layer; on `401`, call `signOut()`.
4. Pass `scriptVersion` from `GET /scripts` through the `WalkDraft` to `POST /me/walks`.
5. Read `scores` from the API in `History.tsx` and delete `calmScore()`.
6. Delete `frontend/src/mock/data.ts` (or keep behind a `VITE_USE_MOCK=true` flag for offline demos — recommended, since the phone-frame demo is useful without a backend).

## 7. Open points

- **Token lifetime vs. walk length.** A 45-minute walk plus surveys must fit inside the token's life. 24 h is safe; don't go shorter than 2 h without refresh tokens.
- **Routing provider.** Decide before implementing `/routes/generate` for real. It changes `RouteOption.path`'s format and adds a server-side API key.
- **Where the calm-score rule is documented for the ethics/research protocol.** `scoring.py` should cite it.
- **Backups / data retention** for a research dataset — Atlas snapshots are probably sufficient, but confirm with the research lead.
