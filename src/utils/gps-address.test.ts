import { describe, expect, it } from 'vitest'
import { formatBigDataCloudAddress, getGpsBusinessLocationName, sanitizeGpsDisplayAddress } from './gps-address'

describe('gPS address display', () => {
  it('removes isolated distant city aliases from cached addresses', () => {
    expect(sanitizeGpsDisplayAddress('汉中市 勉县 定军山镇 北京 昆明')).toBe('汉中市 勉县 定军山镇')
    expect(getGpsBusinessLocationName('汉中市 勉县 定军山镇 北京 昆明')).toBe('汉中市 勉县 定军山镇')
    expect(sanitizeGpsDisplayAddress('定军山镇 勉县 北京 - 昆明')).toBe('定军山镇 勉县')
    expect(getGpsBusinessLocationName('定军山镇 勉县 北京 - 昆明')).toBe('定军山镇 勉县')
  })

  it('keeps complete city and road names', () => {
    expect(sanitizeGpsDisplayAddress('北京市 朝阳区 北京路')).toBe('北京市 朝阳区 北京路')
  })

  it('removes the Qinghai and Haixi prefix from Golmud locations', () => {
    const address = '青海省海西蒙古族藏族自治州格尔木市察尔汗行政委员会G215中国石油昆仑能源青海公司察尔汗LNG加气站西南17米'
    const expected = '格尔木市察尔汗行政委员会G215中国石油昆仑能源青海公司察尔汗LNG加气站西南17米'
    expect(sanitizeGpsDisplayAddress(address)).toBe(expected)
    expect(getGpsBusinessLocationName(address)).toBe(expected)
  })

  it('hides internal address-resolution placeholders', () => {
    expect(sanitizeGpsDisplayAddress('位置解析中')).toBe('')
    expect(sanitizeGpsDisplayAddress('定位信息待更新')).toBe('')
    expect(getGpsBusinessLocationName('位置暂不可用')).toBe('')
    expect(sanitizeGpsDisplayAddress('108.471495, 36.588050')).toBe('')
  })

  it('formats reverse-geocoded administrative data in simplified Chinese', () => {
    expect(formatBigDataCloudAddress({
      principalSubdivision: '青海省',
      city: '海西蒙古族藏族自治州',
      locality: '格爾木市',
      localityInfo: { administrative: [{ name: '郭勒木德镇', adminLevel: 8 }] },
    })).toBe('格尔木市 郭勒木德镇')
  })

  it('keeps prefecture-level cities and detailed place names', () => {
    expect(formatBigDataCloudAddress({
      city: '西安市',
      locality: '长安区',
      localityInfo: {
        administrative: [{ name: '杨庄街道', adminLevel: 8 }],
        informative: [{ name: '冲沟大桥', order: 10 }],
      },
    })).toBe('西安市 长安区 杨庄街道 冲沟大桥')
  })
})
