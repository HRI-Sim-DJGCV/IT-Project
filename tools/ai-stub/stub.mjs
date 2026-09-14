// Stand-in for the Python AI service (server/) so the whole app can be run and
// clicked through without Google / OpenAI keys or the voice model.
// Same endpoints as server/main.py, canned answers:
//   POST /route/generate-from-text  -> a short loop near the University of Melbourne + one park detour
//   POST /script/generate           -> a fixed three-section script
//   POST /tts                       -> a tiny silent mp3
// Started by docker-compose.yml as `ai-stub`. Never deploy this.
import http from 'node:http'

const PORT = Number(process.env.PORT ?? 8001)

function encodePolyline(points) {
  let out = ''
  let prevLat = 0
  let prevLon = 0
  const enc = (v) => {
    let n = v < 0 ? ~(v << 1) : v << 1
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63)
      n >>= 5
    }
    out += String.fromCharCode(n + 63)
  }
  for (const [lat, lon] of points) {
    const la = Math.round(lat * 1e5)
    const lo = Math.round(lon * 1e5)
    enc(la - prevLat)
    enc(lo - prevLon)
    prevLat = la
    prevLon = lo
  }
  return out
}

const loop = [
  [-37.7963, 144.9614],
  [-37.7975, 144.9632],
  [-37.7988, 144.9621],
  [-37.7981, 144.9598],
  [-37.7963, 144.9614],
]
const viaPark = [
  [-37.7963, 144.9614],
  [-37.795, 144.964],
  [-37.794, 144.966],
  [-37.7975, 144.965],
  [-37.7963, 144.9614],
]

const SCRIPT = `[FOCUSED_ATTENTION]
Begin walking at an easy, unhurried pace. Feel each foot meet the ground, heel first, then the roll to the toes. (pause) Notice the air on your face. Let your shoulders drop.

Bring your attention to the rhythm of your steps. In for four steps. Out for four steps. (pause) There is nowhere else to be.

[COMPASSION MEDITATION]
As you walk, picture someone who has been kind to you. Hold them in mind and silently wish them ease. (pause) Now turn that same wish toward yourself. May I be at ease. May I be steady.

Notice any tightness that softens as you say it. (pause)

[CLOSING MEDITATION]
You are nearing the end of this walk. Take one slow breath in, and let it all the way out. Notice how you feel now compared with when you set out. Carry this steadiness with you into the rest of your day.

(This is the STUB script. Real walks get a script written for the route, weather and time.)`

// A minimal valid MP3: a handful of silent MPEG-1 Layer III frames.
const SILENT_FRAME = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(413, 0)])
const SILENT_MP3 = Buffer.concat(Array.from({ length: 20 }, () => SILENT_FRAME))

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    let body = {}
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return json(res, 400, { detail: 'bad json' })
    }
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { status: 'ok', tts: 'stub' })
    if (req.url === '/route/generate-from-text') {
      if (/nowhere/i.test(body.start_location ?? '')) return json(res, 404, { detail: `Location not found: "${body.start_location}"` })
      const total = body.total_travel_time ?? 900
      console.log('[stub] route', body.start_location, '->', body.end_location, total + 's')
      return json(res, 200, {
        origin: { lat: loop[0][0], lon: loop[0][1] },
        destination: { lat: loop[0][0], lon: loop[0][1] },
        total_travel_time: total,
        baseline: { duration_s: Math.round(total * 0.8), distance_m: 1200, polyline: encodePolyline(loop) },
        parks: [
          {
            park: { place_id: 'stub-park', name: 'University Square', lat: -37.794, lon: 144.966 },
            baseline_s: Math.round(total * 0.8),
            detour_s: Math.round(total * 0.95),
            added_s: Math.round(total * 0.15),
            slack_s: Math.round(total * 0.05),
            route:
              body.park_polylines > 0
                ? { duration_s: Math.round(total * 0.95), distance_m: 1500, polyline: encodePolyline(viaPark) }
                : null,
          },
        ],
      })
    }
    if (req.url === '/script/generate') {
      console.log('[stub] script for', body.park ? 'park route' : 'direct route')
      return json(res, 200, { script: SCRIPT, model: 'stub-model', prompt_version: 0 })
    }
    if (req.url === '/tts') {
      console.log('[stub] tts', body.speaker, JSON.stringify((body.text ?? '').slice(0, 40)))
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' })
      return res.end(SILENT_MP3)
    }
    json(res, 404, { detail: 'no such stub endpoint' })
  })
})
server.listen(PORT, () => console.log(`[stub] AI service stand-in on :${PORT}`))
