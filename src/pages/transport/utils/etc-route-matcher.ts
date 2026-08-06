import type { EtcRecord } from '~@/composables/transport-operation-data'

export interface EtcRouteMatch {
  routeCode: string
  routeLine: string
  routeMatchStatus: '已识别' | '待确认' | '未识别'
  routeMatchScore: string
  routeMatchReason: string
  routeJourneyId?: string
  routeSegmentCount?: string
}

function normalizePlace(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u005B\u005D()（）【】\s]/g, '')
    .replace(/(?:高速公路|高速|收费站|收费口|入口|出口|液厂|气站|加气站|门站|母站|站)$/g, '')
    .replace(/[^\p{Script=Han}a-z0-9]/gu, '')
}

function splitRouteName(value: unknown) {
  return String(value ?? '').split(/\s*(?:->|[至到→—–－―-]|_{2,})\s*/).filter(Boolean)
}

function commonPrefixLength(a: string, b: string) {
  const limit = Math.min(a.length, b.length)
  let length = 0
  while (length < limit && a[length] === b[length])
    length++
  return length
}

function placeSimilarity(left: unknown, right: unknown) {
  const a = normalizePlace(left)
  const b = normalizePlace(right)
  if (!a || !b)
    return 0
  if (a === b)
    return 1
  if (Math.min(a.length, b.length) >= 2 && (a.includes(b) || b.includes(a)))
    return 0.9
  return commonPrefixLength(a, b) >= 2 ? 0.75 : 0
}

function routeEndpoints(route: Record<string, string>) {
  const nameParts = splitRouteName(route.name)
  return {
    start: [route.loadingAddress, nameParts[0]].filter((value): value is string => Boolean(value)),
    end: [route.unloadingAddress, route.destinationName, nameParts.at(-1)].filter((value): value is string => Boolean(value)),
  }
}

function bestSimilarity(value: unknown, candidates: string[]) {
  return candidates.reduce((best, candidate) => Math.max(best, placeSimilarity(value, candidate)), 0)
}

function scoreRoute(etc: EtcRecord, route: Record<string, string>) {
  const endpoints = routeEndpoints(route)
  const forwardStart = bestSimilarity(etc.entryInfo, endpoints.start)
  const forwardEnd = bestSimilarity(etc.exitInfo, endpoints.end)
  const reverseStart = bestSimilarity(etc.entryInfo, endpoints.end)
  const reverseEnd = bestSimilarity(etc.exitInfo, endpoints.start)
  const forward = Math.round((forwardStart + forwardEnd) * 50)
  const reverse = Math.round((reverseStart + reverseEnd) * 50)
  const reversed = reverse > forward
  const score = Math.max(forward, reverse)
  const matchedParts = reversed
    ? [reverseStart ? '入口命中目的地' : '', reverseEnd ? '出口命中装货地' : '']
    : [forwardStart ? '入口命中装货地' : '', forwardEnd ? '出口命中目的地' : '']
  return { route, score, reason: matchedParts.filter(Boolean).join('、') || '收费站与路线端点不匹配' }
}

export function matchEtcRoute(etc: EtcRecord, routes: Array<Record<string, string>>): EtcRouteMatch {
  const candidates = routes
    .filter(route => route.status !== '停用')
    .map(route => scoreRoute(etc, route))
    .sort((a, b) => b.score - a.score)
  const best = candidates[0]

  if (!best || best.score < 40) {
    return { routeCode: '', routeLine: '', routeMatchStatus: '未识别', routeMatchScore: String(best?.score ?? 0), routeMatchReason: '未找到匹配的路线端点' }
  }

  return {
    routeCode: best.route.code,
    routeLine: best.route.name,
    routeMatchStatus: '已识别',
    routeMatchScore: String(best.score),
    routeMatchReason: `${best.reason}，自动采用最佳路线：${best.route.name}`,
  }
}

export function decorateEtcRoute(etc: EtcRecord, routes: Array<Record<string, string>>) {
  return { ...etc, ...matchEtcRoute(etc, routes) }
}

interface JourneyChoice {
  end: number
  match?: EtcRouteMatch
}

function journeyGroupKey(row: EtcRecord) {
  return [row.plateNo || row.cardNo, String(row.updatedAt || '').slice(0, 10)].join('|')
}

function matchJourneySpan(rows: EtcRecord[], start: number, end: number, routes: Array<Record<string, string>>) {
  const first = rows[start]
  const last = rows[end]
  return matchEtcRoute({ ...first, exitInfo: last.exitInfo } as EtcRecord, routes)
}

function decorateJourneyGroup(rows: EtcRecord[], routes: Array<Record<string, string>>) {
  const count = rows.length
  const scores = Array.from({ length: count + 1 }, () => Number.NEGATIVE_INFINITY)
  const choices: Array<JourneyChoice | undefined> = Array.from({ length: count })
  scores[count] = 0

  for (let start = count - 1; start >= 0; start--) {
    scores[start] = scores[start + 1] - 25
    choices[start] = { end: start }
    for (let end = start; end < Math.min(count, start + 12); end++) {
      const match = matchJourneySpan(rows, start, end, routes)
      const matchScore = Number(match.routeMatchScore)
      if (!match.routeCode || matchScore < 40)
        continue
      const candidateScore = matchScore - 10 + scores[end + 1]
      if (candidateScore > scores[start]) {
        scores[start] = candidateScore
        choices[start] = { end, match }
      }
    }
  }

  const decorated = rows.map(row => ({ ...row }))
  for (let start = 0; start < count;) {
    const choice = choices[start] || { end: start }
    if (choice.match) {
      const journeyId = `${journeyGroupKey(rows[start])}|${start + 1}-${choice.end + 1}`
      const segmentCount = String(choice.end - start + 1)
      for (let index = start; index <= choice.end; index++) {
        Object.assign(decorated[index], choice.match, {
          routeJourneyId: journeyId,
          routeSegmentCount: segmentCount,
        })
      }
    }
    start = choice.end + 1
  }
  return decorated
}

function normalizePlate(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase()
}

function routeCodeByName(routeName: string, routes: Array<Record<string, string>>) {
  const normalized = normalizePlace(routeName)
  return routes.find(route => normalizePlace(route.name) === normalized)?.code || ''
}

export function decorateEtcRoutes(rows: EtcRecord[], routes: Array<Record<string, string>>, orders: Array<Record<string, string | undefined>> = []) {
  const grouped = new Map<string, Array<{ index: number, row: EtcRecord }>>()
  rows.forEach((row, index) => {
    const key = journeyGroupKey(row)
    const group = grouped.get(key) || []
    group.push({ index, row })
    grouped.set(key, group)
  })

  const result = rows.map(row => ({ ...row }))
  grouped.forEach((group) => {
    const first = group[0]?.row
    const sameDayOrders = orders.filter((order) => {
      return normalizePlate(order.plateNo) === normalizePlate(first?.plateNo)
        && String(order.shipDate || '').slice(0, 10).replace(/\//g, '-') === String(first?.updatedAt || '').slice(0, 10)
        && Boolean(order.routeLine)
    })
    if (sameDayOrders.length === 1) {
      const order = sameDayOrders[0]
      const routeLine = String(order.routeLine)
      const journeyId = `order|${order.code}`
      group.forEach(item => Object.assign(result[item.index], {
        routeCode: routeCodeByName(routeLine, routes),
        routeLine,
        routeMatchStatus: '已识别',
        routeMatchScore: '100',
        routeMatchReason: `同车牌同日期运单：${order.code}`,
        routeJourneyId: journeyId,
        routeSegmentCount: String(group.length),
      }))
      return
    }
    const decorated = decorateJourneyGroup(group.map(item => item.row), routes)
    group.forEach((item, index) => Object.assign(result[item.index], decorated[index]))
  })
  return result
}
