# Frontend / backend integration: meeting summary

*Written 2026-09-13 from the state of `main` plus the unmerged branches `feature/frontend-server-connection` and `feature/material-design`.*

## Where things stand

**Three codebases, one product, no wiring between them.**

- **Frontend** (`frontend/`): React app, complete participant flow plus admin dashboard. Every screen reads and writes through one file, `frontend/src/api/index.ts`, which is backed by in-memory mock data that resets on reload. Auth is a fake login against hard-coded credentials. No token, no session restore, no access-code redemption (that screen is a stub).
- **Node backend** (`backend/`, on `main`): Express + Mongoose + JWT over the team's Atlas cluster. Implements every endpoint the frontend needs, one-for-one with the mock functions, plus admin CRUD, stats, CSV export, and access-code first login. Identity comes from the token, never the body. Seeded with the same demo logins as the frontend. **Nothing calls it yet.**
- **Python server** (`server/`, on the unmerged branch `feature/frontend-server-connection`, 7 Sep): FastAPI app that does real route generation via Google Maps, LLM-generated meditation scripts (OpenAI), and text-to-speech (local Qwen model). That branch also edits the frontend to call it directly for routes and adds a Leaflet map. It has **no auth and no database**, and the frontend on that branch still uses mock data for everything else.

So the backend is the source of truth for auth and persistence, but the most recent frontend work is being wired to a different server that has neither.

## How far the frontend has strayed

Less than you might fear on the data model, more on the route/script feature.

**Good news, already aligned:**

- The domain types are identical. `shared/types.ts` is a superset of `frontend/src/types.ts` (adds `scores`, `scriptVersion`, `active`, API envelopes). The frontend keeps its own copy only because nobody has switched the import.
- Every mock function has a matching endpoint with the same signature. The spec (`docs/backend-api-spec.md` §6) already lists the switch as a checklist confined to one file plus token handling.
- Frontend design decisions that the backend adopted: abandoned walks never saved, condition drives the script, backend owns the calm-score calculation, server assigns participant IDs and access codes, whole-list condition save (`PUT /admin/conditions`).

**Frontend ideas the backend does not yet reflect:**

- **Real routes with geometry.** The connection branch adds `mapPath` (lat/lon points) and `startCoordinates` to the types and calls the Python server's `/route/generate-from-text`. The Node backend's `/routes/generate` still returns the three template routes with a fake 0–100 polyline.
- **Generated scripts and TTS.** The Python server generates scripts per route (with or without a park) and produces audio. The Node backend serves a fixed per-condition script template and the frontend reads it aloud with browser speech synthesis. These are two different product designs for the same feature.
- **Small drifts:** the frontend's `generateRoutes` now takes the full `WalkPlan` instead of just a duration (backend already accepts that, fine); the History screen still computes calm score client-side; the admin list still uses the placeholder `stressStart`/`stressEnd` labels instead of `scores`.

**Backend features the frontend has no UI for yet:** access-code redemption, `PATCH` participant (change condition / deactivate), per-condition script editing, `GET /admin/stats`, server-side CSV, session restore via `GET /me`.

**Concerns on the Python branch to raise:**

- It commits a `.env` containing a Google Maps API key and a whole `.venv` (641 files). The key should be rotated and both removed from git before merge.
- Two entry points (`main.py` and `integration_app.py`) with different endpoint sets; the frontend calls the one in `integration_app.py`.
- Its `/health` conflicts with the Node backend's `/v1/health` on the same default port 8000, so both can't run locally without a port change.
- The draft "landmark" Mongoose models in `backend/src/models/` (Firebase users, walker/admin/creator roles) are a third, older auth design. They are unused, but they will confuse anyone reading the backend.

## Steps needed

1. **Agree on the architecture** (decisions below), then write it into the README and API spec so there is one picture.
2. **Switch the frontend to the Node backend** for auth, walks, history, admin. This is the §6 checklist: env var for base URL, rewrite each function in `api/index.ts` as a `fetch`, store the JWT in `SessionContext`, handle 401, import `shared/types.ts`, keep mock behind a `VITE_USE_MOCK` flag for demos.
3. **Decide how the Python server fits**, then either proxy it through the Node backend (`/routes/generate` and `/scripts` call it server-side, keeping API keys off the client) or expose it directly with its own auth. Proxying is the simpler and safer option and matches what the spec already anticipated.
4. **Clean the connection branch before merge:** remove `.venv` and `.env`, rotate the leaked key, pick one FastAPI entry point, change the port.
5. **Fill the UI gaps** the backend already supports: access-code screen, `scores` in History and admin list, deactivate / reassign participant, server CSV.
6. **Decide the fate of the draft landmark models** (delete, or move to a clearly labelled folder).
7. **Add a smoke test** that runs frontend against the real backend end to end (login, walk, history, admin list) so the two can't silently drift again.

## Decisions the team needs to make

1. **One backend or two?** Does the Python server become a service behind the Node API, or a second public API the frontend talks to directly? (Recommendation: behind Node. Node owns auth, Python owns routes/scripts/audio.)
2. **Which script model wins?** Fixed per-condition script template (Node, editable by researchers, versioned per walk) versus LLM-generated per-route script (Python). This is a research-design question: can the trial tolerate a different script text on every walk? If both, how is `scriptVersion` recorded for analysis?
3. **TTS: browser speech synthesis or server-generated audio?** Server audio needs storage (the branch notes mention AWS) and a GPU or slow CPU inference. Decide for this phase.
4. **Hosting.** Node backend is spec'd for a container host; the Python notes describe an AWS EC2 box behind nginx. Same box, or separate? Who owns deployment?
5. **Route geometry format** in `RouteOption` and stored walks: keep the added `mapPath` lat/lon array, or move to GeoJSON as the spec's open question suggested. Walks are persisted, so this affects the database shape.
6. **Mock data policy.** Keep the mock layer behind a flag for offline demos, or delete it once the switch lands.
7. **Ownership going forward.** Who owns `api/index.ts` and `shared/types.ts`? All three streams touch them, and the drift happened because nobody did.
8. **Secrets hygiene.** Confirm the Google key gets rotated, and agree that `.env` files never get committed.

## Difficulty at a glance

| Link | Effort | Blocker |
|---|---|---|
| Frontend → Node backend | Low, contained to one file plus token handling | None |
| Python server → behind Node backend | Low for the wiring itself (one pass-through per endpoint) | Script-model decision, branch cleanup, hosting cost |
