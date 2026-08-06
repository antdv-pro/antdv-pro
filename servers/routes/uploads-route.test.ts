import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
  validateUploadFile: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
  unlink: mocks.unlink,
  writeFile: mocks.writeFile,
}))
vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
  setResponseStatus: vi.fn(),
}))
vi.mock('../utils/runtime-config', () => ({
  runtimeConfig: { upload: { dir: '/tmp/uploads' } },
}))
vi.mock('../utils/security', () => ({ getAuthenticatedUser: vi.fn() }))
vi.mock('../utils/mysql', () => ({ getMysqlPool: vi.fn() }))
vi.mock('../utils/upload-security', () => ({ validateUploadFile: mocks.validateUploadFile }))

describe('upload route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('makes public uploads readable by the web container', async () => {
    const file = {
      name: 'invoice.pdf',
      size: 4,
      type: 'application/pdf',
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    }
    const event = {
      req: {
        formData: async () => new Map<string, any>([['file', file]]),
      },
    }
    const { default: handler } = await import('./uploads/index.post')

    await expect(handler(event as any)).resolves.toMatchObject({
      code: 200,
      data: { originalName: 'invoice.pdf' },
    })
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('invoice.pdf'),
      expect.any(Buffer),
      { mode: 0o644 },
    )
  })
})
