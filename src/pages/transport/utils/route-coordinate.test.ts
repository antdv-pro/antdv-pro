import { describe, expect, it } from 'vitest'
import { normalizeRouteCoordinateAddress, validRouteCoordinatePair } from './route-coordinate'

describe('route coordinate helpers', () => {
  it('normalizes equivalent address text for coordinate lookup', () => {
    expect(normalizeRouteCoordinateAddress(' 西宁 市（东川工业园）， ')).toBe('西宁市东川工业园')
  })

  it('accepts valid longitude and latitude pairs only', () => {
    expect(validRouteCoordinatePair('101.234567', '36.123456')).toEqual([101.234567, 36.123456])
    expect(validRouteCoordinatePair('181', '36')).toBeUndefined()
    expect(validRouteCoordinatePair('', '36')).toBeUndefined()
  })
})
