import { describe, expect, it } from 'vitest'
import { repairDeep, repairMojibake } from './text-repair'

describe('repairMojibake', () => {
  it('repairs Windows-1252 mojibake returned by production', () => {
    expect(repairMojibake('è¶…çº§ç®¡ç†å‘˜')).toBe('超级管理员')
    expect(repairMojibake('ç»¼åˆç®¡ç†éƒ¨')).toBe('综合管理部')
    expect(repairMojibake('ç³»ç»Ÿç®¡ç†å‘˜')).toBe('系统管理员')
    expect(repairMojibake('é©¾é©¶å‘˜')).toBe('驾驶员')
  })

  it('leaves valid text unchanged', () => {
    expect(repairMojibake('超级管理员')).toBe('超级管理员')
    expect(repairMojibake('admin@example.com')).toBe('admin@example.com')
  })

  it('repairs nested plain data', () => {
    expect(repairDeep({ user: { nickname: 'è¶…çº§ç®¡ç†å‘˜' } })).toEqual({
      user: { nickname: '超级管理员' },
    })
  })
})
