export interface BaseImportColumn {
  title: string
  dataIndex: string
}

export interface BaseImportTab {
  key: string
  columns: BaseImportColumn[]
}

const baseImportHeaderAliases: Record<string, string[]> = {
  code: ['编号', '档案编号', '客户编号', '路线编号', '序号'],
  name: ['名称', '路线名称', '司押人员'],
  plateNo: ['车号', '车牌号', '车辆', '主车号'],
  trailerNo: ['挂号', '挂车号', '挂车牌号'],
  driverName: ['司机', '驾驶员', '司机姓名', '驾驶员姓名'],
  driverPhone: ['司机电话', '驾驶员电话', '司机手机号'],
  driverCertNo: ['司机证号', '驾驶员证号', '从业资格证号', '司机从业资格证号'],
  driverCertValidTo: ['司机证件有效期', '司机有效期', '驾驶员证件有效期'],
  escortName: ['押运员', '押运姓名', '押运员姓名'],
  escortPhone: ['押运电话', '押运员电话', '押运手机号'],
  escortCertNo: ['押运证号', '押运员证号', '押运从业资格证号'],
  escortCertValidTo: ['押运证件有效期', '押运员有效期', '押运员证件有效期'],
  loadingAddress: ['起始地', '始发地', '出发地', '装货地', '装货地址'],
  destinationName: ['目的地', '到达地', '终点'],
  destinationArea: ['目的地行政区域', '目的地区域', '到达地区域'],
  unloadingAddress: ['目的地详细地址', '卸货地', '卸货地址', '到达地详细地址'],
  loadingLongitude: ['装车经度', '装货经度', '装车地经度', '装货地经度', '起始地经度'],
  loadingLatitude: ['装车纬度', '装货纬度', '装车地纬度', '装货地纬度', '起始地纬度'],
  unloadingLongitude: ['卸车经度', '卸货经度', '卸车地经度', '卸货地经度', '目的地经度'],
  unloadingLatitude: ['卸车纬度', '卸货纬度', '卸车地纬度', '卸货地纬度', '目的地纬度'],
  distance: ['运距', '运距km', '运输距离', '里程km'],
  insuranceExpireDate: ['保险到期', '保险到期日', '保险有效期'],
  inspectionExpireDate: ['年检到期', '年检到期日', '年检有效期'],
}

const driverHeaders = ['驾驶员', '司机', '驾驶员姓名', '司机姓名']
const escortHeaders = ['押运员', '押运姓名', '押运员姓名']

export function normalizeImportHeader(value: unknown) {
  return String(value ?? '')
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, '')
    .trim()
    .replace(/[\s（）()]/g, '')
    .toLowerCase()
}

export function createStableImportCode(prefix: string, value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${prefix}-${(hash >>> 0).toString(36).toUpperCase()}`
}

export function createBaseImportFieldMap(tab: BaseImportTab, formColumns: BaseImportColumn[]) {
  const map = new Map<string, string>()
  const columns = tab.key === 'crew' || tab.key === 'vehicle' ? formColumns : tab.columns
  columns.forEach((column) => {
    map.set(normalizeImportHeader(column.title), column.dataIndex)
    map.set(normalizeImportHeader(column.dataIndex), column.dataIndex)
  })
  Object.entries(baseImportHeaderAliases).forEach(([field, aliases]) => {
    aliases.forEach(alias => map.set(normalizeImportHeader(alias), field))
  })
  if (tab.key === 'route')
    map.set(normalizeImportHeader('客户名称'), 'customer')
  else if (tab.key === 'customer')
    map.set(normalizeImportHeader('客户名称'), 'name')
  return map
}

export function findBaseImportHeaderRow(matrix: unknown[][], fieldMap: Map<string, string>) {
  let bestIndex = -1
  let bestScore = 0
  matrix.slice(0, 30).forEach((row, index) => {
    const fields = new Set(row.map(cell => fieldMap.get(normalizeImportHeader(cell))).filter(Boolean))
    if (fields.size > bestScore) {
      bestIndex = index
      bestScore = fields.size
    }
  })
  return bestScore > 0 ? bestIndex : -1
}

export function selectBaseImportSheet(sheets: Array<{ matrix: unknown[][] }>, tabKey: string, fieldMap: Map<string, string>) {
  const candidates = sheets.map(({ matrix }) => {
    const headerIndex = findBaseImportHeaderRow(matrix, fieldMap)
    const headers = headerIndex >= 0 ? matrix[headerIndex].map(normalizeImportHeader) : []
    const matchedFieldCount = new Set(headers.map(header => fieldMap.get(header)).filter(Boolean)).size
    const isCrewDetailSheet = tabKey === 'crew'
      && headers.some(header => driverHeaders.includes(header))
      && headers.some(header => escortHeaders.includes(header))
    return { matrix, headerIndex, score: matchedFieldCount + (isCrewDetailSheet ? 100 : 0) }
  })
  return candidates.sort((left, right) => right.score - left.score)[0] ?? { matrix: [], headerIndex: -1, score: 0 }
}

export function parseCrewImportRows(matrix: unknown[][], headerIndex: number) {
  const headers = matrix[headerIndex].map(normalizeImportHeader)
  const driverIndex = headers.findIndex(header => driverHeaders.includes(header))
  const escortIndex = headers.findIndex(header => escortHeaders.includes(header))
  if (driverIndex < 0 || escortIndex < 0)
    return []
  const fieldByIndex: Record<number, string> = {}
  headers.forEach((header, index) => {
    if (['序号', '编号'].includes(header)) {
      fieldByIndex[index] = 'code'
    }
    else if (['车号', '车牌号', '牌照号'].includes(header)) {
      fieldByIndex[index] = 'plateNo'
    }
    else if (['挂号', '挂车号', '挂车牌照号'].includes(header)) {
      fieldByIndex[index] = 'trailerNo'
    }
    else if (index === driverIndex) {
      fieldByIndex[index] = 'driverName'
    }
    else if (index === escortIndex) {
      fieldByIndex[index] = 'escortName'
    }
    else if (index > driverIndex && index < escortIndex) {
      if (header.includes('资格证') || header.includes('证号'))
        fieldByIndex[index] = 'driverCertNo'
      else if (header.includes('有效期'))
        fieldByIndex[index] = 'driverCertValidTo'
      else if (header.includes('电话') || header.includes('手机'))
        fieldByIndex[index] = 'driverPhone'
    }
    else if (index > escortIndex) {
      if (header.includes('资格证') || header.includes('证号'))
        fieldByIndex[index] = 'escortCertNo'
      else if (header.includes('有效期'))
        fieldByIndex[index] = 'escortCertValidTo'
      else if (header.includes('电话') || header.includes('手机'))
        fieldByIndex[index] = 'escortPhone'
      else if (header.includes('备注'))
        fieldByIndex[index] = 'remark'
    }
  })
  return matrix.slice(headerIndex + 1).map((values) => {
    const row: Record<string, unknown> = {}
    Object.entries(fieldByIndex).forEach(([index, field]) => {
      row[field] = values[Number(index)] ?? ''
    })
    return row
  })
}
