# Architecture

State of `main` as of 2026-10-20. Both diagrams are Mermaid, which GitHub renders.

## System architecture

How the code is organised and what talks to what.

```mermaid
flowchart LR
    subgraph Browser["Phone browser"]
        SPA["<b>Web app</b> · frontend/<br/>React 19 · Vite · MUI · Tailwind · React Router<br/><br/>Participant: login / access code, pre-survey,<br/>plan, select route, prepare, walk, post-survey, history<br/>Admin: dashboard, participants, analytics, settings"]
    end

    Shared["<b>shared/</b><br/>domain types · survey ·<br/>scoring · week helpers"]

    subgraph API["Node API · backend/ · Express 5 + Mongoose"]
        direction TB
        Routes["<b>/v1 routes</b><br/>/auth: login, access code (JWT, rate-limited)<br/>/me: profile, walks, walk preparation + audio<br/>/routes/generate<br/>/admin: conditions, participants, walks,<br/>CSV export, analytics"]
        Services["<b>services</b><br/>routeGeneration · preparation (script + TTS)<br/>analytics · weekly cron (Mon 00:00 UTC)<br/>googleMaps (geocode) · walkCsv · accessCode"]
        Audio[("Generated MP3s<br/>AUDIO_DIR")]
        Routes --> Services
        Services --> Audio
    end

    subgraph AI["AI service · server/ · FastAPI"]
        AIRoutes["POST /route/generate-path<br/>POST /route/generate-from-text<br/>POST /script/generate<br/>POST /tts"]
    end

    Stub["<b>AI stub</b> · tools/ai-stub<br/>same endpoints, canned answers<br/>(local Docker dev only)"]

    Mongo[("<b>MongoDB Atlas</b><br/>Account · Condition · WalkPreparation<br/>WalkRecord · ParticipantMetrics · WeeklyReport")]

    subgraph Ext["External services"]
        GMapsJS["Google Maps JS + Places<br/>(place autocomplete)"]
        OSM["OpenStreetMap tiles<br/>(Leaflet route map)"]
        Geocode["Google Geocoding"]
        GoogleAI["Google Routes · Places (New)<br/>Elevation · Weather"]
        Gemini["Gemini 2.5 Flash<br/>(meditation scripts)"]
        TTS["Google Cloud Text-to-Speech<br/>(narration audio)"]
    end

    SPA -->|"HTTPS JSON · Bearer JWT"| Routes
    SPA --> GMapsJS
    SPA --> OSM
    Shared -.->|imported by| SPA
    Shared -.->|imported by| API
    Services --> Mongo
    Services --> Geocode
    Services -->|"HTTP · X-Internal-Key"| AIRoutes
    Services -.->|"AI_SERVICE_URL points here<br/>in local Docker dev"| Stub
    AIRoutes --> GoogleAI
    AIRoutes --> Gemini
    AIRoutes --> TTS
```

**Notes**

- The Node API is the only entry point for the app. The AI service is internal and is never called by the browser.
- The AI service requires an `X-Internal-Key` header on every route except `/health`.
- `shared/` is compiled into both the web app and the API, so survey questions and scoring can't drift apart.
- Local `docker-compose.yml` uses the AI stub by default; `docker-compose.real.yml` swaps in the real service.

## Deployment

What runs where in production today.

```mermaid
flowchart TB
    User(["Participants and researchers<br/>phone browser"])
    Dev(["Developers"])

    subgraph GH["GitHub · HRI-Sim-DJGCV/IT-Project"]
        Repo["main branch"]
        CI["GitHub Actions CI<br/>typecheck · lint · test · build<br/>Docker image build"]
        Deploy["Deploy backend workflow<br/>runs after CI passes on main<br/>OIDC → AWS, no stored keys"]
    end

    subgraph Vercel["Vercel"]
        Static["<b>walkingmed.vercel.app</b><br/>static build of frontend/<br/>SPA rewrite → index.html<br/>VITE_API_BASE_URL baked in at build"]
    end

    subgraph AWS["AWS · ap-southeast-2 · default VPC, public subnet"]
        EIP["Elastic IP 32.236.180.226<br/>32-236-180-226.sslip.io"]
        subgraph SG["Security group walking-meditation-api · inbound 80, 443 only"]
            subgraph EC2["EC2 t3.small · Amazon Linux 2023 · 20 GB gp3 · 2 GB swap · SSM role"]
                subgraph Compose["Docker Compose · deploy/docker-compose.prod.yml"]
                    Caddy["<b>caddy</b> :80 / :443<br/>auto HTTPS, reverse proxy"]
                    Api["<b>api</b> :8000<br/>Node API (backend/Dockerfile)"]
                    Ai["<b>ai</b> :8001 (internal only)<br/>FastAPI AI service (server/)<br/>gets only its own keys"]
                    Vol[("volumes<br/>audio · caddy-data")]
                end
                Env["deploy/.env<br/>secrets, root-only"]
            end
        end
        SSM["Systems Manager<br/>Session Manager · Run Command"]
    end

    Atlas[("<b>MongoDB Atlas</b><br/>IP allowlist: 32.236.180.226")]
    LE["Let's Encrypt"]
    Google["Google Maps Platform"]
    GoogleAI["Gemini · Cloud TTS · Routes<br/>Places · Elevation · Weather"]

    User -->|"HTTPS"| Static
    User -->|"HTTPS API calls<br/>CORS: walkingmed.vercel.app, *.vercel.app"| EIP
    User -->|"Maps JS + Places"| Google
    EIP --> Caddy
    Caddy --> Api
    Api -->|"X-Internal-Key"| Ai
    Ai --> GoogleAI
    Api --> Vol
    Caddy --> Vol
    Env -.-> Api
    Env -.-> Ai
    Api -->|"TLS"| Atlas
    Api -->|"Geocoding"| Google
    Caddy -.->|"ACME certificate"| LE

    Dev -->|"push / merge PR"| Repo
    Repo --> CI
    Repo -->|"auto deploy on main,<br/>previews on PRs"| Static
    CI -->|"success on main"| Deploy
    Deploy -->|"SSM Run Command"| SSM
    Dev -->|"shell access, no SSH"| SSM
    SSM -.->|"checkout tested commit<br/>+ compose up --build"| EC2
```

**Notes**

- Vercel redeploys the frontend on every merge to `main`. The backend redeploys automatically once CI passes on `main`: `.github/workflows/deploy-backend.yml` signs in to AWS with OIDC and uses SSM to check out the exact commit CI tested and rebuild the containers. It skips the rebuild if nothing under `backend/`, `server/`, `shared/` or `deploy/` changed, skips with a warning if the instance is stopped, and finishes with a health check on `/v1/health`. Manual steps are in [deploy/README.md](../deploy/README.md).
- The AI service container receives only the keys it needs (Google Maps, Gemini, TTS, internal key), never the database or JWT secrets.
- The AWS account is on the free plan, with $100 in credits that expire 2027-04-09, so only free-tier instance types can be used.
- The real AI service runs in production. It calls hosted Gemini and Google Cloud Text-to-Speech instead of running a local TTS model, so it fits on the t3.small.
