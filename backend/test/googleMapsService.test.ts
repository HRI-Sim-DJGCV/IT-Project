import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchNearbyParks } from '../src/services/googleMapsService'

afterEach(() => vi.unstubAllGlobals())

describe('Google Places park search', () => {
  it('requests nearby green-space place types and returns named coordinates', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              displayName: { text: 'Epping Recreation Reserve' },
              location: { latitude: -37.65, longitude: 145.02 },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)

    const parks = await searchNearbyParks([145.01, -37.65], 1_500)

    expect(parks).toEqual([
      {
        name: 'Epping Recreation Reserve',
        location: [145.02, -37.65],
      },
    ])
    const [url, request] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby')
    expect(JSON.parse(request?.body as string)).toEqual(
      expect.objectContaining({
        includedTypes: expect.arrayContaining(['park', 'garden', 'hiking_area']),
        rankPreference: 'DISTANCE',
      }),
    )
  })
})
