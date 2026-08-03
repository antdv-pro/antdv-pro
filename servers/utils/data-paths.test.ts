import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const originalCwd = process.cwd()
const temporaryRoots: string[] = []

afterEach(() => {
  process.chdir(originalCwd)
  temporaryRoots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }))
  vi.resetModules()
})

describe('persistent data paths', () => {
  it('copies seed data once and keeps later runtime changes', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'persistent-data-')))
    temporaryRoots.push(root)
    const seedDir = join(root, 'storage/test-data/json')
    mkdirSync(seedDir, { recursive: true })
    writeFileSync(join(seedDir, 'system.json'), '{"users":["seed"]}')
    process.chdir(root)

    const { resolveJsonDataFile } = await import('./data-paths')
    const runtimeFile = resolveJsonDataFile('system.json')
    expect(runtimeFile).toBe(join(root, 'storage/runtime/json/system.json'))
    expect(JSON.parse(readFileSync(runtimeFile, 'utf-8'))).toEqual({ users: ['seed'] })

    writeFileSync(runtimeFile, '{"users":["saved"]}')
    writeFileSync(join(seedDir, 'system.json'), '{"users":["new-seed"]}')
    expect(resolveJsonDataFile('system.json')).toBe(runtimeFile)
    expect(JSON.parse(readFileSync(runtimeFile, 'utf-8'))).toEqual({ users: ['saved'] })
    expect(existsSync(runtimeFile)).toBe(true)
  })
})
