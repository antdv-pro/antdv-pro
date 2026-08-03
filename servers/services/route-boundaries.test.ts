import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(target) : entry.name.endsWith('.ts') ? [target] : []
  })
}

function forbiddenImports(directory: string, storeNames: string[]) {
  const pattern = new RegExp(`utils/(${storeNames.join('|')})`)
  return sourceFiles(directory)
    .filter(file => pattern.test(fs.readFileSync(file, 'utf8')))
    .map(file => path.relative(process.cwd(), file))
}

describe('route service boundaries', () => {
  it('keeps system routes behind domain services', () => {
    expect(forbiddenImports(path.resolve('servers/routes/system'), ['system-store'])).toEqual([])
  })

  it('keeps GPS routes behind domain services', () => {
    expect(forbiddenImports(path.resolve('servers/routes/gps'), ['gps-store'])).toEqual([])
  })

  it('keeps reverse-geocoding providers outside the GPS store', () => {
    const source = fs.readFileSync(path.resolve('servers/utils/gps-store.ts'), 'utf8')
    expect(source).not.toContain('nominatim.openstreetmap.org')
    expect(source).not.toContain('photon.komoot.io')
    expect(source).not.toContain('reverse-geocode-client')
    expect(source).not.toContain('/v3/geocode/regeo')
  })

  it('keeps the 808GPS protocol implementation outside the GPS store', () => {
    const source = fs.readFileSync(path.resolve('servers/utils/gps-store.ts'), 'utf8')
    expect(source).not.toContain('StandardApiAction_')
    expect(source).not.toContain('function create808GpsProvider')
    expect(source).not.toContain('interface GpsProviderAdapter')
  })

  it('keeps approval routes behind domain services', () => {
    expect(forbiddenImports(path.resolve('servers/routes/approval'), [
      'approval-store',
      'oa-module-store',
      'wecom-approval-store',
    ])).toEqual([])
  })

  it('keeps approval domain services behind repositories', () => {
    expect(forbiddenImports(path.resolve('servers/services/approval'), ['approval-store'])).toEqual([])
  })
})
