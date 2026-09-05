# IT-Project — Walking Meditation

A guided walking-meditation app for a stress regulation trial. Participants check in, plan a walk, follow a spoken meditation script while walking, then check in again. Researchers will later view the collected records.

## Structure

| Folder | What | Status |
|---|---|---|
| `frontend/` | React + TypeScript mobile web app (Vite, Tailwind, React Router) | Participant flow built with mock data |
| `backend/` | Python API + MongoDB | Not started |

## Running the frontend

Requires Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

Then open <http://localhost:5173> — ideally in your browser's mobile device emulation, since the UI is designed for phone screens.

Demo login: choose **Participant**, user ID `demo`, password `demo`.

**Phone preview:** open <http://localhost:5173/phone.html> to see the app inside an iPhone-sized frame — handy for demos on a laptop. The same page works on any deployment (`/phone.html`).

Other commands (run from `frontend/`):

```bash
npm run build     # type-check and build to frontend/dist
npm run preview   # serve the production build locally
npm run lint      # oxlint
```

## Deploying to Vercel

Import the repo in Vercel and set **Root Directory** to `frontend`. The SPA rewrite in `frontend/vercel.json` handles client-side routes.

## Notes

- All data is currently mocked in `frontend/src/mock/data.ts` and served through `frontend/src/api/index.ts`. Replace the functions in `api/` with real requests once the backend exists.
- The map on the walk screens is a placeholder pending a map provider.
- The meditation script is read aloud with the browser's built-in speech synthesis.
