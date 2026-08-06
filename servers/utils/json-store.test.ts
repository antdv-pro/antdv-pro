import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readJsonFile, writeJsonFile } from './json-store'

describe('json store', () => {
  it('returns fallbacks for missing and malformed files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'json-store-'))
    expect(readJsonFile(join(dir, 'missing.json'), { ok: false })).toEqual({ ok: false })
    const malformed = join(dir, 'bad.json')
    writeFileSync(malformed, '{bad')
    expect(readJsonFile(malformed, [])).toEqual([])
  })

  it('creates parent directories and writes readable formatted JSON', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'json-store-')), 'nested', 'state.json')
    writeJsonFile(file, { enabled: true })
    expect(readJsonFile(file, {})).toEqual({ enabled: true })
    expect(readFileSync(file, 'utf8')).toContain('\n  "enabled": true\n')
  })
})
