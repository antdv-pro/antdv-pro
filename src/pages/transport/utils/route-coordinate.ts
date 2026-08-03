export type RouteCoordinatePair = [number, number]

export function normalizeRouteCoordinateAddress(value: unknown) {
  return String(value ?? '').trim().replace(/[\s()（）·・,，。]/g, '').toLowerCase()
}

export function validRouteCoordinatePair(longitude: unknown, latitude: unknown): RouteCoordinatePair | undefined {
  if (String(longitude ?? '').trim() === '' || String(latitude ?? '').trim() === '')
    return undefined
  const pair: RouteCoordinatePair = [Number(longitude), Number(latitude)]
  return Number.isFinite(pair[0]) && Number.isFinite(pair[1]) && Math.abs(pair[0]) <= 180 && Math.abs(pair[1]) <= 90
    ? pair
    : undefined
}
