# IT-Project — Walking Meditation

A guided walking-meditation app for a stress regulation trial. Participants check in, plan a walk, follow a spoken meditation script while walking, then check in again. Researchers will later view the collected records.

## Structure

| Folder | What | Status |
|---|---|---|
| `frontend/` | React + TypeScript mobile web app (Vite, Tailwind, React Router) | Participant flow built with mock data |
| `backend/` | Python API + MongoDB | Not started |
| `docs/` | Project documentation — [frontend-domain-model.md](docs/frontend-domain-model.md), [backend-api-spec.md](docs/backend-api-spec.md) (draft) | |

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
| <http://localhost:5173/phone.html> | The app inside an iPhone-sized frame | Demos and screenshots on a laptop |

Both are fully interactive. The phone frame is a static page (`frontend/public/phone.html`) that loads the app in an iframe, so it also works on any deployment at `/phone.html`.

Demo login: choose **Participant**, user ID `demo`, password `demo`.

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
