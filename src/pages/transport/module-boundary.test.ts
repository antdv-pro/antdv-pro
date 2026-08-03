import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('transport module state boundaries', () => {
  it('keeps form, query, pagination and modal state in a composable', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/module.vue'), 'utf8')
    expect(source).toContain('useTransportModuleState } from \'./composables/use-transport-module-state\'')
    expect(source).not.toContain('const queryModel = reactive({')
    expect(source).not.toContain('const orderModalOpen = ref(false)')
    expect(source).not.toContain('const baseDataModalOpen = ref(false)')
    expect(source).not.toContain('const tablePagination = reactive({')
    expect(source).not.toContain('const importPreview = reactive<')
  })

  it('separates the state by responsibility', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/composables/use-transport-module-state.ts'), 'utf8')
    expect(source).toContain('useTransportOrderForm')
    expect(source).toContain('useTransportBaseDataState')
    expect(source).toContain('useTransportQueryState')
    expect(source).toContain('useTransportImportState')
    expect(source.split('\n').length).toBeLessThanOrEqual(30)
  })

  it('uses the same full-width summary layout as regulatory fee management', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/module.vue'), 'utf8')
    const overviewPanel = source.match(/<section class="transport-overview-panel">([\s\S]*?)<\/section>/)?.[1] ?? ''

    expect(overviewPanel).toContain('<SummaryCards')
    expect(overviewPanel).not.toContain('transport-page-title')
    expect(overviewPanel).not.toContain('transport-page-description')
    expect(overviewPanel).not.toContain('<a-row')
  })

  it('limits transport customer analytics and options to the selected financial period', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/module.vue'), 'utf8')

    expect(source).toContain('.filter(row => matchesFinancialRange(row, fiscalPayload))')
    expect(source).toContain('return rowMonthKey === selectedMonthKey')
    expect(source).toContain('if (!rowDate?.isValid())\n    return false')
    expect(source).toContain('<TransportOrderAnalytics v-if="route.name === \'TransportOrders\'" :rows="tableRows" />')
  })

  it('parses formatted freight and weight values for analytics', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/components/transport-order-analytics.vue'), 'utf8')

    expect(source).toContain('replace(/[^\\d.-]/g, \'\')')
    expect(source).toContain('number(row.taxedFreight) || number(row.freightTotal)')
    expect(source).toContain('number(row.receivedWeight) || number(row.sentWeight)')
    expect(source).not.toContain('if (income <= 0 && volume <= 0)')
  })

  it('shows GPS-derived transport progress for order status while preserving workflow status elsewhere', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/module.vue'), 'utf8')
    const statusStart = source.indexOf('function getDisplayedStatus(')
    const statusEnd = source.indexOf('function getDisplayedStatusColor(', statusStart)
    const getDisplayedStatus = source.slice(statusStart, statusEnd)

    expect(getDisplayedStatus).toContain('if (route.name === \'TransportOrders\')')
    expect(getDisplayedStatus).toContain('return getTransportStageTag(record).label')
    expect(getDisplayedStatus).toContain('return record.approvalStatus || record.status || \'-\'')
  })

  it('does not label a located vehicle as loading unless it is inside the order route loading fence', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/module.vue'), 'utf8')
    const resolverStart = source.indexOf('function resolveTransportStage(')
    const resolverEnd = source.indexOf('function getTransportStageTag(', resolverStart)
    const resolver = source.slice(resolverStart, resolverEnd)

    expect(resolver).toContain('const nearbyFence = getNearbyOrderGpsFence(record)')
    expect(resolver).toContain('resolveGpsRouteStageByAddress(getOrderGpsLocationLabel(record)')
    expect(resolver).toContain('if (addressStage)\n    return addressStage')
    expect(resolver).toContain('if (!location && routeFence && /待审核|待派车|待装车|装车|草稿/.test(status))')
    expect(source).toContain('fenceName: nearbyFence?.name || \'\'')
  })

  it('supports file, folder and manual fuel entry without rewriting the full transport dataset', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/module.vue'), 'utf8')
    const importStart = source.indexOf('async function persistFuelRecords(')
    const importEnd = source.indexOf('async function readFuelRowsFromFile(', importStart)
    const fuelImport = source.slice(importStart, importEnd)

    expect(source).toContain('webkitdirectory')
    expect(source).toContain('<TransportOperationCreateModal')
    expect(fuelImport).toContain('importTransportFuelApi(rows)')
    expect(fuelImport).not.toContain('flushTransportOperationData')
  })

  it('saves maintenance dialogs through partition APIs instead of full transport replacement', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/maintenance/index.vue'), 'utf8')
    const submitStart = source.indexOf('async function handleSubmit()')
    const submitEnd = source.indexOf('async function handleDelete(', submitStart)
    const inventoryStart = source.indexOf('async function handleInventorySubmit()')
    const inventoryEnd = source.indexOf('function renderChart(', inventoryStart)
    const importStart = source.indexOf('async function confirmMaintenanceImport()')
    const importEnd = source.indexOf('function formatAmount(', importStart)

    expect(source.slice(submitStart, submitEnd)).toContain('createMaintenanceRecordApi')
    expect(source.slice(inventoryStart, inventoryEnd)).toContain('createMaintenanceInventoryApi')
    expect(source.slice(importStart, importEnd)).toContain('importMaintenanceRecordsApi')
    expect(source.slice(submitStart, submitEnd)).not.toContain('flushTransportOperationData')
    expect(source.slice(inventoryStart, inventoryEnd)).not.toContain('flushTransportOperationData')
    expect(source.slice(importStart, importEnd)).not.toContain('flushTransportOperationData')
  })
})
