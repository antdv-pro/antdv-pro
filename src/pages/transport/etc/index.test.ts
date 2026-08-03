import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('eTC import entry', () => {
  const source = fs.readFileSync(path.resolve('src/pages/transport/etc/index.vue'), 'utf8')

  it('uses one import action that opens a combined file picker', () => {
    const toolbarStart = source.indexOf('<a-card title="ETC费用列表"')
    const toolbarEnd = source.indexOf('<a-table', toolbarStart)
    const toolbar = source.slice(toolbarStart, toolbarEnd)

    expect(toolbar).toContain('导入ETC明细')
    expect(toolbar).not.toContain('导入文件夹')
    expect(toolbar).not.toContain('ref="fileInput"')
  })

  it('supports files and folders before the existing import preview', () => {
    expect(source).toContain('title="选择ETC费用发票明细文件"')
    expect(source).toContain('ok-text="解析所选文件"')
    expect(source).toContain('<a-upload-dragger')
    expect(source).toContain('webkitdirectory')
    expect(source).toContain('@change="addSelectedFolder"')
    expect(source).toContain('void handleFiles(files)')
    expect(source).toContain('title="ETC费用导入确认"')
  })

  it('renders actual-route analysis in the compact ETC ranking layout', () => {
    expect(source).toContain('<strong>ETC路线费用排行</strong>')
    expect(source).toContain('const routeRanking = computed(() => pageData.actualRouteAnalysis.slice(0, 8))')
    expect(source).toContain('v-for="item in routeRanking"')
    expect(source).toContain('{{ item.recordCount }}笔')
    expect(source).toContain('item.matchBasis')
    expect(source).not.toContain('<section class="actual-route-analysis"')
    expect(source).not.toContain('v-for="item in pageData.routeRanking"')
  })
})
