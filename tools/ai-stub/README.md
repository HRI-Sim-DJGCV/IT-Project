# AI service stub

A stand-in for the Python AI service in `server/`, so the whole app can be run and clicked through without Google or OpenAI keys and without the voice model.

It answers the same three endpoints the Node API calls, with canned data:

| Endpoint | Returns |
|---|---|
| `POST /route/generate-from-text` | A short loop near the University of Melbourne, plus one park detour |
| `POST /script/generate` | A fixed three-section script, marked as `stub-model` |
| `POST /tts` | A tiny silent mp3 |

Started automatically by `docker compose up` as the `ai-stub` service. To run it by hand: `node tools/ai-stub/stub.mjs` (port 8001).

Walks saved while the stub is running carry `script.model = "stub-model"`, so they are easy to find and delete before real data collection.
