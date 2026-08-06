import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const guardedModals = [
  ['src/pages/transport/fees/index.vue', 'submitting'],
  ['src/pages/transport/maintenance/index.vue', 'submitting'],
  ['src/pages/transport/vehicle-loans/index.vue', 'submitting'],
  ['src/pages/transport/module.vue', 'orderSaving'],
  ['src/pages/approval/index.vue', 'createSubmitting'],
  ['src/pages/system/index.vue', 'modalSaving'],
  ['src/pages/trade/orders/index.vue', 'submitting'],
  ['src/pages/hotel/revenue/index.vue', 'saving'],
] as const

describe('business modal submission boundaries', () => {
  it.each(guardedModals)('%s protects the primary submit flow with %s', (file, state) => {
    const source = fs.readFileSync(path.resolve(file), 'utf8')
    expect(source).toContain(`:confirm-loading="${state}"`)
    expect(source).toContain(`:closable="!${state}"`)
    expect(source).toContain(`:keyboard="!${state}"`)
    expect(source).toContain(`:cancel-button-props="{ disabled: ${state} }"`)
  })
})
