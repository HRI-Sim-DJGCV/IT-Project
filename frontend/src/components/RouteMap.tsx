import { useEffect } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import type { RouteOption } from '../types'
import { MapPlaceholder } from './MapPlaceholder'

type MapPoint = [number, number]

const EMPTY_POSITIONS: MapPoint[] = []

interface FitMapProps {
  positions: MapPoint[]
  centre: MapPoint
}

function FitMap({ positions, centre }: FitMapProps) {
  const map = useMap()

  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [20, 20] })
    } else {
      map.setView(centre, 15)
    }
  }, [map, positions, centre])

  return null
}

// Uses the same timer-based movement calculation as the original placeholder.
function estimatedPosition(
  positions: MapPoint[],
  progress: number | undefined,
): MapPoint | null {
  if (progress === undefined || positions.length < 2) return null

  const segmentCount = positions.length - 1
  const routeProgress =
    Math.min(Math.max(progress, 0), 1) * segmentCount
  const index = Math.min(Math.floor(routeProgress), segmentCount - 1)
  const fraction = routeProgress - index

  const [lat1, lon1] = positions[index]
  const [lat2, lon2] = positions[index + 1]

  return [
    lat1 + (lat2 - lat1) * fraction,
    lon1 + (lon2 - lon1) * fraction,
  ]
}

interface RouteMapProps {
  route?: RouteOption | null
  currentLocation?: MapPoint | null
  showCurrentLocationMarker?: boolean
  progress?: number
  className?: string
}

export function RouteMap({
  route,
  currentLocation,
  showCurrentLocationMarker = true,
  progress,
  className = '',
}: RouteMapProps) {
  const positions = route?.mapPath ?? EMPTY_POSITIONS
  const centre = positions[0] ?? currentLocation
  const walkerPosition = estimatedPosition(positions, progress)

  if (!centre) {
    return (
      <MapPlaceholder
        route={route}
        progress={progress}
        className={className}
      />
    )
  }

  const start = positions[0]
  const destination = positions[positions.length - 1]

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line ${className}`}
    >
      <MapContainer
        center={centre}
        zoom={15}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {positions.length > 1 ? (
          <>
            <Polyline
              positions={positions}
              pathOptions={{
                color: '#1e2a44',
                weight: 5,
                opacity: 0.9,
              }}
            />

            <CircleMarker
              center={start}
              radius={7}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#1e2a44',
                fillOpacity: 1,
                weight: 2,
              }}
            />

            <CircleMarker
              center={destination}
              radius={7}
              pathOptions={{
                color: '#1e2a44',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 2,
              }}
            />
          </>
        ) : null}

        {currentLocation && showCurrentLocationMarker ? (
          <CircleMarker
            center={currentLocation}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#2563eb',
              fillOpacity: 1,
              weight: 3,
            }}
          />
        ) : null}

        {walkerPosition ? (
          <CircleMarker
            center={walkerPosition}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#2563eb',
              fillOpacity: 1,
              weight: 3,
            }}
          />
        ) : null}

        <FitMap positions={positions} centre={centre} />
      </MapContainer>
    </div>
  )
}