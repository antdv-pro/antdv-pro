import { describe, expect, it } from 'vitest'
import { deepFind } from './tree'

describe('deepFind', () => {
  const tree: any[] = [{ id: 1, children: [{ id: 2 }] }, { id: 3 }]

  it('finds both nested and sibling nodes', () => {
    expect(deepFind(node => node.id === 2)(tree)).toEqual({ id: 2 })
    expect(deepFind(node => node.id === 3)(tree)).toEqual({ id: 3 })
  })

  it('returns undefined for empty trees and misses', () => {
    expect(deepFind(() => true)([])).toBeUndefined()
    expect(deepFind(node => node.id === 9)(tree)).toBeUndefined()
  })
})
