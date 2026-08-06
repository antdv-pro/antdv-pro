export interface GpsFenceForm {
  id: string
  name: string
  address: string
  routeCode: string
  routeStage: 'loading' | 'unloading'
  shape: 'circle' | 'polygon'
  centerLongitude: number
  centerLatitude: number
  radius: number
  polygonPoints: string
  enabled: boolean
  vehicleIds: string[]
}

export interface FenceJudgment {
  insideCount: number
  locatedCount: number
  staleCount: number
}
