import { Converter } from 'opencc-js'

const toSimplifiedChinese = Converter({ from: 'tw', to: 'cn' })

const businessLocationNames = [
  { keyword: '青海省海西州格尔木物流园', name: '公司停车场' },
  { keyword: '青海省海西州察尔汗中石油站', name: '察尔汗中石油' },
  { keyword: '陕西省汉中市勉县庆港站', name: '勉县庆港站' },
]

const standaloneCityAliases = new Set([
  '北京',
  '上海',
  '天津',
  '重庆',
  '广州',
  '深圳',
  '成都',
  '昆明',
  '西安',
  '武汉',
  '南京',
  '杭州',
])

const unresolvedAddressPattern = /^(?:位置解析中|位置暂不可用|定位信息待更新|精确坐标)/
const coordinateAddressPattern = /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,2}(?:\.\d+)?$/
const qinghaiHaixiPrefixPattern = /^青海省(?:海西蒙古族藏族自治州|海西州)/

export function sanitizeGpsDisplayAddress(address?: string) {
  const parts = String(address ?? '').trim().replace(qinghaiHaixiPrefixPattern, '').trim().split(/\s+/).filter(Boolean)
  const routeSeparatorIndex = parts.findIndex((part, index) =>
    /^[-–—至]$/.test(part)
    && standaloneCityAliases.has(parts[index - 1])
    && standaloneCityAliases.has(parts[index + 1]),
  )
  if (routeSeparatorIndex > 0)
    parts.splice(routeSeparatorIndex - 1, 3)
  const confirmedCity = parts.find(part => part.endsWith('市'))
  const normalizedAddress = confirmedCity
    ? parts.filter(part => !standaloneCityAliases.has(part) || `${part}市` === confirmedCity).join(' ')
    : parts.join(' ')
  return unresolvedAddressPattern.test(normalizedAddress) || coordinateAddressPattern.test(normalizedAddress) ? '' : normalizedAddress
}

export function getGpsBusinessLocationName(address?: string) {
  const normalizedAddress = sanitizeGpsDisplayAddress(address)
  if (!normalizedAddress)
    return ''
  return businessLocationNames.find(item => normalizedAddress.includes(item.keyword))?.name || normalizedAddress
}

export function formatBigDataCloudAddress(data: Record<string, any>) {
  const administrative = Array.isArray(data.localityInfo?.administrative) ? data.localityInfo.administrative : []
  const informative = Array.isArray(data.localityInfo?.informative) ? data.localityInfo.informative : []
  return [
    String(data.city ?? '').endsWith('市') ? data.city : '',
    data.locality || data.city,
    ...administrative
      .filter((item: Record<string, any>) => Number(item.adminLevel) >= 8)
      .sort((a: Record<string, any>, b: Record<string, any>) => Number(a.adminLevel) - Number(b.adminLevel))
      .map((item: Record<string, any>) => item.name),
    ...informative
      .filter((item: Record<string, any>) => Number(item.order) >= 10)
      .map((item: Record<string, any>) => item.name),
  ]
    .map(value => toSimplifiedChinese(String(value ?? '').trim()))
    .filter(value => value && value !== '中华人民共和国' && !/[省州]$/.test(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' ')
}
