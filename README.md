# IT-Project — Walking Meditation

A guided walking-meditation app for a stress regulation trial. Participants check in, plan a walk, follow a spoken meditation script while walking, then check in again. Researchers will later view the collected records.

## Structure

| Folder | What | Status |
|---|---|---|
| `frontend/` | React + TypeScript mobile web app (Vite, Tailwind, React Router) | Participant flow and admin dashboard built with mock data |
| `backend/` | Node + TypeScript API (Express, Mongoose, Zod, JWT) over MongoDB Atlas | Phase 1 participant endpoints and the admin endpoints implemented; frontend not yet switched over |
| `shared/` | Domain types and the calm-score rule, imported by the backend (and by the frontend once it switches from its local copy) | |
| `docs/` | Project documentation — [frontend-domain-model.md](docs/frontend-domain-model.md), [backend-api-spec.md](docs/backend-api-spec.md) | |

## Running the frontend

Requires Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

`npm run dev` only starts the server — it doesn't open a browser. The URL you open decides what you see:

| URL | What you get | Use it for |
|---|---|---|
| <http://localhost:5173> | The app on its own, filling the window | What you'd load on a real phone; use Chrome DevTools device emulation (Ctrl+Shift+M → "iPhone 14 Pro") for accurate touch/safe-area behaviour |
| <http://localhost:5173/phone.html> | The app inside an iPhone-sized frame, with a toggle to a desktop Chrome-style window | Demos and screenshots on a laptop; the device scales down to fit the window |

Both are fully interactive. The preview is a static page (`frontend/public/phone.html`) that loads the app in an iframe, so it also works on any deployment at `/phone.html`. Switching between Phone and Browser reloads the app at its current route.

Demo logins (mock data, reset on reload):

| Role | User ID | Password | Lands on |
|---|---|---|---|
| Participant | `demo` | `demo` | Home → walk flow |
| Research admin | `admin` | `admin` | Admin dashboard (`/admin`) |
| Medical professional | `doctor` | `doctor` | Admin dashboard (`/admin`) |

The admin dashboard lists participants, adds a participant (the mock assigns the next `AAA###` id and shows a single-use access code once), edits conditions, and exports one CSV row per walk.

Other commands (run from `frontend/`):

```bash
npm run build     # type-check and build to frontend/dist
npm run preview   # serve the production build locally
npm run lint      # oxlint
```

## Running the backend

Requires Node.js 20+ and access to the team's MongoDB Atlas cluster.

```bash
cd backend
cp .env.example .env     # then fill in MONGODB_URI and JWT_SECRET (see comments in the file)
npm install
npm run seed             # idempotent: conditions A/B, the demo logins above, two sample walks
npm run dev              # http://localhost:8000/v1, reloads on save
```

`GET /v1/health` reports the database connection. The seeded logins are the same as the frontend's demo logins (`demo`/`demo`, `admin`/`admin`, `doctor`/`doctor`), so the frontend can be pointed at the API without changing any accounts. Endpoints, collections and error format are in [docs/backend-api-spec.md](docs/backend-api-spec.md).

The backend uses the `accounts`, `conditions` and `walkRecords` collections in the `walkingapp` database. Other collections in that database belong to the landmark-guided walk model planned for a later phase; their Mongoose schemas are in `backend/src/models/` but no endpoint uses them yet.

## Deploying to Vercel

Import the repo in Vercel and set **Root Directory** to `frontend`. The SPA rewrite in `frontend/vercel.json` handles client-side routes.

## Notes

- The frontend still uses mock data from `frontend/src/mock/data.ts` served through `frontend/src/api/index.ts`. Switching it to the backend is confined to that file plus token handling; see section 6 of the API spec.
- The map on the walk screens is a placeholder pending a map provider.
- The meditation script is read aloud with the browser's built-in speech synthesis.
