import type { RouteOption } from '../types'

interface Props {
  route?: RouteOption | null
  /** 0–1 progress along the route, draws the walker dot */
  progress?: number
  className?: string
}

/**
 * Placeholder map. Draws a faux street grid and, if given, the route
 * polyline. To be replaced by a real map provider later.
 */
export function MapPlaceholder({ route, progress, className = '' }: Props) {
  const points = route?.path ?? []
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')

  let dot: [number, number] | null = null
  if (route && progress !== undefined && points.length > 1) {
    const segs = points.length - 1
    const t = Math.min(Math.max(progress, 0), 1) * segs
    const i = Math.min(Math.floor(t), segs - 1)
    const f = t - i
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    dot = [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f]
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-accent/40 ${className}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <pattern id="grid" width="12.5" height="12.5" patternUnits="userSpaceOnUse">
            <path d="M 12.5 0 L 0 0 0 12.5" fill="none" stroke="#b9cbe4" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        {d ? (
          <>
            <path d={d} fill="none" stroke="#1e2a44" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={points[0][0]} cy={points[0][1]} r="2.6" fill="#1e2a44" />
            <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.6" fill="#ffffff" stroke="#1e2a44" strokeWidth="1.4" />
            {dot ? <circle cx={dot[0]} cy={dot[1]} r="3.2" fill="#2563eb" stroke="#fff" strokeWidth="1.2" /> : null}
          </>
        ) : null}
      </svg>
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-card/80 px-2 py-0.5 text-[10px] font-medium text-muted">
        Map placeholder
      </span>
    </div>
  )
}
