import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('transport import worker boundary', () => {
  const moduleSource = fs.readFileSync(path.resolve('src/pages/transport/module.vue'), 'utf8')

  it('keeps binary workbook and PDF decoding off the UI thread', () => {
    expect(moduleSource).not.toContain('XLSX.read(')
    expect(moduleSource).not.toContain('pdfjsLib')
    expect(moduleSource).not.toContain('file.arrayBuffer()')
  })

  it('routes transport imports through the worker client', () => {
    expect(moduleSource).toContain('parseTransportWorkbook')
    expect(moduleSource).toContain('extractTransportPdfText')
  })
})
