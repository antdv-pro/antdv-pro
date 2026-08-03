import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('shared business layout boundaries', () => {
  it('keeps modal controls and inline query forms responsive', () => {
    const styles = fs.readFileSync(path.resolve('src/assets/styles/reset.css'), 'utf8')

    expect(styles).toContain('.ant-modal-root .ant-form-item-control-input-content > .ant-select')
    expect(styles).toContain('.ant-form-inline .query-actions')
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)')
  })

  it('defines the complete receipt allocation layout', () => {
    const styles = fs.readFileSync(path.resolve('src/pages/approval/oa-module.less'), 'utf8')
    const source = fs.readFileSync(path.resolve('src/pages/approval/oa-module.vue'), 'utf8')

    for (const className of [
      'receipt-allocation-meta',
      'receipt-allocation-row',
      'receipt-allocation-field',
      'receipt-allocation-delete',
      'receipt-allocation-summary',
    ]) {
      expect(source).toContain(`class="${className}`)
      expect(styles).toContain(`.${className}`)
    }
  })
})
