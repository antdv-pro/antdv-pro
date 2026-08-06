import { beforeEach, describe, expect, it, vi } from 'vitest'

const h3 = vi.hoisted(() => ({
  defineEventHandler: vi.fn((handler: any) => handler),
  getQuery: vi.fn(),
  setResponseStatus: vi.fn(),
}))

vi.mock('h3', () => h3)

describe('weather location route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h3.getQuery.mockReturnValue({ latitude: '34.7472531', longitude: '113.6193205' })
  })

  it('returns a usable fallback when reverse geocoding is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream unavailable')))
    const { default: handler } = await import('./weather/location.get')

    await expect(handler({} as any)).resolves.toEqual({
      code: 200,
      data: { location: '当前位置', degraded: true },
      msg: '地点解析暂时不可用，已使用当前位置',
    })
    expect(h3.setResponseStatus).not.toHaveBeenCalled()
  })

  it('still rejects invalid coordinates', async () => {
    h3.getQuery.mockReturnValue({ latitude: 'invalid', longitude: '113.6' })
    const { default: handler } = await import('./weather/location.get')

    await expect(handler({} as any)).resolves.toEqual({ code: 400, msg: '定位坐标无效' })
    expect(h3.setResponseStatus).toHaveBeenCalledWith({}, 400)
  })
})
