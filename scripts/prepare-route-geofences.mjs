#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const routesPath = process.argv[2] || '/tmp/production_routes_utf8.json'
const geocodingPath = process.argv[3] || '/tmp/amap_route_geocoding_review.json'
const outputPath = process.argv[4] || '/tmp/route_geofence_plan.json'

const routes = JSON.parse(await readFile(routesPath, 'utf8'))
const geocoding = JSON.parse(await readFile(geocodingPath, 'utf8'))

const overrides = {
  '宁强旭日综合能源有限公司': ['106.297666', '32.833185', '高德POI精确名称'],
  '安塞华油天然气有限公司': ['109.354005', '36.763938', '高德POI安塞区LNG站'],
  '新沃达天然气有限公司': ['108.767373', '36.701202', '高德POI精确名称'],
  '格尔木天然气液化厂': ['94.960192', '36.384169', '青HA4752现场定位'],
  '榆林金源天然气有限公司': ['110.081660', '37.578763', '高德POI精确名称'],
  '青海油田采油五厂天然气处理站': ['91.194086', '38.037221', '高德POI采油五厂驻地'],
  '西藏自治区拉萨市堆龙德庆区林琼岗路西100米正北方向90米': ['91.017104', '29.630128', '高德POI林琼岗路'],
  '陕西省咸阳市三原县关中环线中国石油LNG加气站': ['109.007771', '34.646952', '高德POI三原寇家加气站'],
  '陕西省咸阳市彬州市太峪镇３１２国道太峪石化': ['107.957007', '34.867058', '高德POI太峪服务区加油站'],
  '陕西省咸阳市泾阳县云阳镇关中环线中国石油加油站(泾云路)': ['108.817648', '34.612957', '高德POI云阳加油站'],
  '陕西省咸阳市泾阳县桥底镇关中环线中国石油(官苗村)': ['108.703067', '34.599300', '高德POI桥底加油加气站'],
  '陕西省商洛市商南县商郧路豪城物流': ['110.865604', '33.477419', '高德POI豪诚物流'],
  '陕西省汉中市宁强县１０８国道候家台子二组': ['106.251826', '32.836721', '高德POI侯家台子'],
  '陕西省渭南市大荔县１０８国道中石化加油站': ['109.887343', '34.778992', '高德POI中石化大荔西站'],
  '陕西省渭南市富平县淡村镇石川河烧烤': ['109.188275', '34.723420', '高德POI石川河兄弟烧烤'],
  '陕西省渭南市蒲城县紫荆街道中石油加油站': ['109.599898', '34.941822', '高德POI迎宾路加油站'],
  '陕西省渭南市蒲城县罕井镇２０１省道罕井加油站': ['109.594969', '35.101784', '高德POI中国石油罕井加油站'],
  '陕西省西安市蓝田县普化镇３１２国道石油服务区加油站': ['109.404582', '34.158696', '高德POI蓝田东服务区加油站'],
  '陕西省西安市长安区杨庄街道冲沟大桥': ['109.143341', '34.059241', '高德POI冲沟大桥'],
  '陕西省西安市高陵区３１０国道加油站': ['109.078753', '34.492299', '高德POI高陵易拓加油站'],
  '青海省海西蒙古族藏族自治州格尔木市唐古拉镇１０９国道': ['92.439965', '34.211016', '高德POI沓沓河加油站'],
  '青海省海西蒙古族藏族自治州格尔木市察尔汗工行委３１５国道': ['93.826966', '37.622209', '高德POI察尔汗315国道'],
}

const geocodesByPlace = new Map(geocoding.map(item => [item.source.place, item]))

function coordinateFor(address) {
  const override = overrides[address]
  if (override) {
    return {
      center: [Number(override[0]), Number(override[1])],
      source: override[2],
    }
  }

  const item = geocodesByPlace.get(address)
  const first = item?.geocodes?.find(candidate => candidate.location)
  if (!first)
    throw new Error(`缺少坐标: ${address}`)
  const [longitude, latitude] = first.location.split(',').map(Number)
  return {
    center: [longitude, latitude],
    source: `高德地址解析-${item.classification}`,
  }
}

const uniquePlaces = new Set()
const fences = []
for (const route of routes) {
  for (const stage of ['loading', 'unloading']) {
    const address = stage === 'loading' ? route.loadingAddress : route.unloadingAddress
    const name = stage === 'loading' ? route.loadingFenceName : route.unloadingFenceName
    const radiusText = stage === 'loading' ? route.loadingFenceRadius : route.unloadingFenceRadius
    const radius = Math.round(Number.parseFloat(radiusText || '1') * 1000)
    const coordinate = coordinateFor(address)
    uniquePlaces.add(address)
    fences.push({
      id: `route-fence-${route.code}-${stage}`,
      name: name || `${route.code}-${stage === 'loading' ? '装车' : '卸车'}围栏`,
      address,
      shape: 'circle',
      center: coordinate.center,
      radius: Number.isFinite(radius) && radius > 0 ? radius : 1000,
      routeCode: route.code,
      routeName: route.name,
      routeStage: stage,
      enabled: true,
      coordinateSource: coordinate.source,
    })
  }
}

const routeCodes = new Set(routes.map(route => route.code))
if (routes.length !== 48 || routeCodes.size !== 48)
  throw new Error(`路线数异常: ${routes.length} 条, ${routeCodes.size} 个唯一编码`)
if (uniquePlaces.size !== 43)
  throw new Error(`地点数异常: ${uniquePlaces.size}`)
if (fences.length !== 96)
  throw new Error(`围栏数异常: ${fences.length}`)
if (new Set(fences.map(fence => fence.id)).size !== fences.length)
  throw new Error('围栏 ID 重复')
if (fences.some(fence => fence.center.some(value => !Number.isFinite(value))))
  throw new Error('存在非法坐标')

const plan = {
  generatedAt: new Date().toISOString(),
  summary: {
    routeCount: routes.length,
    placeCount: uniquePlaces.size,
    fenceCount: fences.length,
    loadingFenceCount: fences.filter(fence => fence.routeStage === 'loading').length,
    unloadingFenceCount: fences.filter(fence => fence.routeStage === 'unloading').length,
  },
  fences,
}

await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`)
console.log(JSON.stringify(plan.summary))
