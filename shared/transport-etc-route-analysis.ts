export interface EtcRouteAnalysisRecord extends Record<string, unknown> {
  amount?: string | number
  cardNo?: string
  entryInfo?: string
  exitInfo?: string
  name?: string
  plateNo?: string
  routeJourneyId?: string
  routeLine?: string
  updatedAt?: string
}

export interface EtcActualRouteAnalysis {
  routeCode: string
  routeLine: string
  distance: number | null
  amount: number
  recordCount: number
  estimatedJourneyCount: number
  matchedRecordCount: number
  inferredRecordCount: number
  confidence: '已核对' | '推断' | '待确定'
  matchBasis: string
  corridors: Array<{
    route: string
    amount: number
    recordCount: number
  }>
}

interface RouteIdentity {
  key: string
  code: string
  name: string
  distance: number | null
}

interface ResolvedRecord {
  record: EtcRouteAnalysisRecord
  route?: RouteIdentity
  basis?: '运单核对' | '记录路线' | '基础路线端点' | '收费走廊推断'
  corridorKey: string
  corridorLabel: string
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function number(value: unknown) {
  const result = Number(text(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(result) ? result : 0
}

function normalizePlate(value: unknown) {
  return text(value).replace(/[\s·・]/g, '').toUpperCase()
}

function normalizePlace(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[\u005B\u005D()（）【】\s]/g, '')
    .replace(/高速公路|高速|收费站|收费口|入口|出口|有限责任公司|有限公司|综合能源|天然气|lng|加油加气站|加气站|加油站|液厂|母站|门站|站/g, '')
    .replace(/陕西省|青海省|西藏自治区|[省市县区镇乡]/g, '')
    .replace(/[^\p{Script=Han}a-z0-9]/gu, '')
}

function splitRoute(value: unknown) {
  return text(value).split(/\s*(?:->|[至到→—–－―-]|_{2,})\s*/).filter(Boolean)
}

function similarity(left: unknown, right: unknown) {
  const a = normalizePlace(left)
  const b = normalizePlace(right)
  if (!a || !b)
    return 0
  if (a === b)
    return 1
  if (Math.min(a.length, b.length) >= 2 && (a.includes(b) || b.includes(a)))
    return 0.9
  let prefix = 0
  while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix])
    prefix += 1
  return prefix >= 2 ? 0.7 : 0
}

function routeEndpoints(route: Record<string, unknown>) {
  const parts = splitRoute(route.name)
  return {
    start: [route.loadingAddress, parts[0]].filter(Boolean),
    end: [route.unloadingAddress, route.destinationName, parts.at(-1)].filter(Boolean),
  }
}

function bestSimilarity(value: unknown, candidates: unknown[]) {
  return candidates.reduce((best, candidate) => Math.max(best, similarity(value, candidate)), 0)
}

function routeIdentity(route: Record<string, unknown>): RouteIdentity {
  const name = text(route.name || route.routeLine)
  return {
    key: text(route.code) || `route:${normalizePlace(name)}`,
    code: text(route.code),
    name,
    distance: number(route.distance || route.mileage) || null,
  }
}

function matchBaseRoute(routeName: unknown, routes: Array<Record<string, unknown>>) {
  const parts = splitRoute(routeName)
  if (parts.length < 2)
    return undefined
  const scored = routes.map((route) => {
    const endpoints = routeEndpoints(route)
    const forward = (bestSimilarity(parts[0], endpoints.start) + bestSimilarity(parts.at(-1), endpoints.end)) / 2
    const reverse = (bestSimilarity(parts[0], endpoints.end) + bestSimilarity(parts.at(-1), endpoints.start)) / 2
    return { route, score: Math.max(forward, reverse) }
  }).sort((left, right) => right.score - left.score)
  if (!scored[0] || scored[0].score < 0.75)
    return undefined
  if (scored[1] && scored[0].score === scored[1].score)
    return undefined
  return routeIdentity(scored[0].route)
}

function corridor(record: EtcRouteAnalysisRecord) {
  const entry = text(record.entryInfo)
  const exit = text(record.exitInfo)
  const normalized = [normalizePlace(entry), normalizePlace(exit)].filter(Boolean).sort()
  return {
    key: normalized.length === 2 ? normalized.join('|') : '',
    label: entry && exit ? `${entry} ↔ ${exit}` : text(record.name) || '收费站信息不完整',
  }
}

function routeFromOrder(order: Record<string, unknown>, routes: Array<Record<string, unknown>>) {
  const name = text(order.routeLine || order.name)
  if (!name)
    return undefined
  return matchBaseRoute(name, routes) || routeIdentity({
    code: text(order.routeCode || order.routeId),
    name,
    distance: order.distance || order.mileage,
  })
}

function orderKey(plateNo: unknown, date: unknown) {
  return `${normalizePlate(plateNo)}|${text(date).slice(0, 10).replace(/\//g, '-')}`
}

function resolvedRouteFromOrders(record: EtcRouteAnalysisRecord, orderRoutes: Map<string, RouteIdentity[]>) {
  const candidates = orderRoutes.get(orderKey(record.plateNo, record.updatedAt)) || []
  const unique = new Map(candidates.map(route => [route.key || route.name, route]))
  return unique.size === 1 ? [...unique.values()][0] : undefined
}

function directRoute(record: EtcRouteAnalysisRecord, routes: Array<Record<string, unknown>>) {
  const explicit = text(record.routeLine)
  if (explicit && explicit !== text(record.name))
    return matchBaseRoute(explicit, routes)
  const entry = text(record.entryInfo)
  const exit = text(record.exitInfo)
  if (!entry || !exit)
    return undefined
  return matchBaseRoute(`${entry}-${exit}`, routes)
}

function buildJourneyKey(item: ResolvedRecord, index: number) {
  const explicit = text(item.record.routeJourneyId)
  if (explicit)
    return explicit
  const plate = normalizePlate(item.record.plateNo || item.record.cardNo)
  const date = text(item.record.updatedAt).slice(0, 10)
  return plate && date ? `${plate}|${date}|${item.route?.key || item.corridorKey}` : `record:${index}`
}

export function analyzeEtcActualRoutes(
  records: EtcRouteAnalysisRecord[],
  routes: Array<Record<string, unknown>>,
  orders: Array<Record<string, unknown>>,
): EtcActualRouteAnalysis[] {
  const activeRoutes = routes.filter(route => !/停用/.test(text(route.status)))
  const orderRoutes = new Map<string, RouteIdentity[]>()
  orders.forEach((order) => {
    const route = routeFromOrder(order, activeRoutes)
    const key = orderKey(order.plateNo, order.shipDate || order.updatedAt)
    if (!route || key.startsWith('|') || key.endsWith('|'))
      return
    const items = orderRoutes.get(key) || []
    items.push(route)
    orderRoutes.set(key, items)
  })

  const resolved: ResolvedRecord[] = records.map((record) => {
    const toll = corridor(record)
    const orderRoute = resolvedRouteFromOrders(record, orderRoutes)
    if (orderRoute)
      return { record, route: orderRoute, basis: '运单核对', corridorKey: toll.key, corridorLabel: toll.label }
    const explicit = text(record.routeLine)
    const route = directRoute(record, activeRoutes)
    return {
      record,
      route,
      basis: route ? (explicit && explicit !== text(record.name) ? '记录路线' : '基础路线端点') : undefined,
      corridorKey: toll.key,
      corridorLabel: toll.label,
    }
  })

  const corridorEvidence = new Map<string, Map<string, { route: RouteIdentity, count: number }>>()
  resolved.forEach((item) => {
    if (!item.route || !item.corridorKey || item.basis === '收费走廊推断')
      return
    const routesForCorridor = corridorEvidence.get(item.corridorKey) || new Map()
    const evidence = routesForCorridor.get(item.route.key) || { route: item.route, count: 0 }
    evidence.count += 1
    routesForCorridor.set(item.route.key, evidence)
    corridorEvidence.set(item.corridorKey, routesForCorridor)
  })

  resolved.forEach((item) => {
    if (item.route || !item.corridorKey)
      return
    const evidence = [...(corridorEvidence.get(item.corridorKey)?.values() || [])].sort((a, b) => b.count - a.count)
    const total = evidence.reduce((sum, value) => sum + value.count, 0)
    if (evidence[0] && evidence[0].count >= 2 && evidence[0].count / total >= 0.8) {
      item.route = evidence[0].route
      item.basis = '收费走廊推断'
    }
  })

  const groups = new Map<string, EtcActualRouteAnalysis & { journeyKeys: Set<string>, basisSet: Set<string>, corridorMap: Map<string, { route: string, amount: number, recordCount: number }> }>()
  resolved.forEach((item, index) => {
    const identity = item.route || { key: 'unmatched', code: '', name: '待确定路线', distance: null }
    const group = groups.get(identity.key) || {
      routeCode: identity.code,
      routeLine: identity.name,
      distance: identity.distance,
      amount: 0,
      recordCount: 0,
      estimatedJourneyCount: 0,
      matchedRecordCount: 0,
      inferredRecordCount: 0,
      confidence: '待确定' as const,
      matchBasis: '',
      corridors: [],
      journeyKeys: new Set<string>(),
      basisSet: new Set<string>(),
      corridorMap: new Map(),
    }
    const amount = number(item.record.amount)
    group.amount += amount
    group.recordCount += 1
    group.journeyKeys.add(buildJourneyKey(item, index))
    if (item.basis === '收费走廊推断')
      group.inferredRecordCount += 1
    else if (item.basis)
      group.matchedRecordCount += 1
    if (item.basis)
      group.basisSet.add(item.basis)
    const corridorItem = group.corridorMap.get(item.corridorKey || item.corridorLabel) || { route: item.corridorLabel, amount: 0, recordCount: 0 }
    corridorItem.amount += amount
    corridorItem.recordCount += 1
    group.corridorMap.set(item.corridorKey || item.corridorLabel, corridorItem)
    groups.set(identity.key, group)
  })

  return [...groups.values()].map((group) => {
    group.estimatedJourneyCount = group.journeyKeys.size
    group.confidence = group.matchedRecordCount === group.recordCount
      ? '已核对'
      : group.matchedRecordCount + group.inferredRecordCount === group.recordCount
        ? '推断'
        : '待确定'
    group.matchBasis = [...group.basisSet].join('、') || '待录入同车同日订单后自动查验'
    group.corridors = [...group.corridorMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 4)
    const { journeyKeys: _journeyKeys, basisSet: _basisSet, corridorMap: _corridorMap, ...result } = group
    return result
  }).sort((left, right) => right.amount - left.amount)
}
