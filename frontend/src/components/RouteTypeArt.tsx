import { Box } from '@mui/material'
import type { RouteType } from '../types'

interface Palette {
  bg: string
  street: string
  main: string
  route: string
  park: string
  tree: string
  house: string
  ring: string
}

const LIGHT: Palette = {
  bg: '#eef1ee',
  street: '#ffffff',
  main: '#d3d8d4',
  route: 'var(--color-primary, #1e2a44)',
  park: '#cfe6d0',
  tree: '#86bf8d',
  house: '#dadfdb',
  ring: '#ffffff',
}
const HIGH_CONTRAST: Palette = {
  bg: '#000000',
  street: '#444444',
  main: '#777777',
  route: '#FFFF00',
  park: '#0a3d0a',
  tree: '#1f8f1f',
  house: '#666666',
  ring: '#000000',
}

const GRID_X = [50, 110, 170, 230, 290]
const GRID_Y = [30, 70, 110]

function Streets({ c, skip = [] }: { c: Palette; skip?: string[] }) {
  return (
    <g stroke={c.street} strokeWidth={7} strokeLinecap="round" fill="none">
      {GRID_Y.map((y) => (skip.includes(`h${y}`) ? null : <line key={`h${y}`} x1={0} y1={y} x2={320} y2={y} />))}
      {GRID_X.map((x) => (skip.includes(`v${x}`) ? null : <line key={`v${x}`} x1={x} y1={0} x2={x} y2={140} />))}
    </g>
  )
}

function StartMarker({ c, x, y }: { c: Palette; x: number; y: number }) {
  return <circle cx={x} cy={y} r={7} fill={c.route} stroke={c.ring} strokeWidth={3} />
}

function Scene({ routeType, c }: { routeType: RouteType; c: Palette }) {
  const route = { fill: 'none', stroke: c.route, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

  switch (routeType) {
    case 'loop':
      return (
        <>
          <Streets c={c} skip={['v290']} />
          <path
            d="M82 104 C58 102 48 72 70 50 C92 28 172 24 216 40 C262 56 256 96 214 106 C170 116 110 108 82 104 Z"
            {...route}
          />
          <StartMarker c={c} x={82} y={104} />
        </>
      )
    case 'out_and_back':
      return (
        <>
          <Streets c={c} skip={['h30']} />
          <path d="M55 102 H110 V66 H200 V46 H268" {...route} />
          <path d="M60 110 H116 V74 H206 V54 H274" {...route} strokeWidth={3} strokeDasharray="2 8" opacity={0.7} />
          <StartMarker c={c} x={55} y={102} />
          <g>
            <line x1={272} y1={46} x2={272} y2={22} stroke={c.route} strokeWidth={3} strokeLinecap="round" />
            <path d="M272 22 L296 30 L272 38 Z" fill={c.route} />
          </g>
        </>
      )
    case 'quiet_streets':
      return (
        <>
          <Streets c={c} skip={['h110']} />
          <rect x={0} y={112} width={320} height={22} fill={c.main} />
          <line x1={0} y1={123} x2={320} y2={123} stroke={c.street} strokeWidth={3} strokeDasharray="14 10" />
          {[
            [62, 38], [124, 80], [184, 38], [244, 80], [20, 80], [262, 36],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={14} height={11} rx={2} fill={c.house} />
          ))}
          <path d="M50 96 V70 H110 V30 H170 V70 H230 V30 H290" {...route} />
          <StartMarker c={c} x={50} y={96} />
        </>
      )
    case 'green_space':
      return (
        <>
          <Streets c={c} skip={['v110', 'v170', 'h70']} />
          <path d="M18 22 Q70 2 126 24 T156 82 Q100 116 40 98 Z" fill={c.park} />
          <path d="M198 30 Q262 6 306 40 T296 112 Q240 128 204 98 Z" fill={c.park} />
          {[
            [48, 44, 9], [82, 30, 11], [112, 54, 9], [70, 78, 11], [128, 84, 8], [44, 82, 8],
            [228, 48, 10], [262, 36, 11], [284, 76, 9], [240, 92, 11], [214, 70, 8],
          ].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c.tree} />
          ))}
          <path d="M28 114 C78 104 96 62 150 64 S218 104 262 66 S298 46 300 44" {...route} />
          <StartMarker c={c} x={28} y={114} />
        </>
      )
  }
}

/** A small, decorative map-style picture of a route type. It isn't a real route: the text beside it carries the meaning. */
export function RouteTypeArt({ routeType, highContrast }: { routeType: RouteType; highContrast: boolean }) {
  const c = highContrast ? HIGH_CONTRAST : LIGHT
  return (
    <Box aria-hidden sx={{ lineHeight: 0, bgcolor: c.bg }}>
      <svg viewBox="0 0 320 140" width="100%" height="auto" preserveAspectRatio="xMidYMid slice" style={{ display: 'block', aspectRatio: '320 / 140' }}>
        <rect width={320} height={140} fill={c.bg} />
        <Scene routeType={routeType} c={c} />
      </svg>
    </Box>
  )
}
