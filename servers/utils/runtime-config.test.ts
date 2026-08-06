import { afterEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  vi.resetModules()
})

describe('runtime config', () => {
  it('uses defaults for absent or invalid numeric settings and parses lists', async () => {
    process.env.PORT = '-1'
    process.env.DB_PORT = 'invalid'
    process.env.DB_CONNECT_TIMEOUT_MS = 'invalid'
    process.env.UPLOAD_ALLOWED_EXTENSIONS = ' .pdf, , .xlsx '
    const { runtimeConfig } = await import('./runtime-config')
    expect(runtimeConfig.app.port).toBe(3000)
    expect(runtimeConfig.database.port).toBe(3306)
    expect(runtimeConfig.database.connectTimeoutMs).toBe(5000)
    expect(runtimeConfig.upload.allowedExtensions).toEqual(['.pdf', '.xlsx'])
  })

  it('does not require production secrets in development', async () => {
    process.env.NODE_ENV = 'development'
    const { validateProductionConfig } = await import('./runtime-config')
    expect(validateProductionConfig).not.toThrow()
  })

  it('reports missing and weak production secrets without duplicates', async () => {
    process.env.NODE_ENV = 'production'
    process.env.DB_HOST = 'db'
    process.env.DB_USER = 'app'
    process.env.DB_NAME = 'app'
    process.env.DB_PASSWORD = 'change_me_password'
    process.env.JWT_SECRET = 'short'
    process.env.SESSION_SECRET = 'short'
    process.env.ADMIN_INITIAL_PASSWORD = 'admin'
    const { validateProductionConfig } = await import('./runtime-config')
    expect(validateProductionConfig).toThrow('生产环境缺少安全配置: DB_PASSWORD, JWT_SECRET(至少32位), SESSION_SECRET(至少32位), ADMIN_INITIAL_PASSWORD(至少12位且不能使用常见默认值)')
  })

  it('accepts complete production configuration', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      DB_HOST: 'db',
      DB_USER: 'app',
      DB_NAME: 'app',
      DB_PASSWORD: 'secret',
      JWT_SECRET: 'j'.repeat(32),
      SESSION_SECRET: 's'.repeat(32),
      ADMIN_INITIAL_PASSWORD: 'strong-admin-bootstrap-2026',
    })
    const { validateProductionConfig } = await import('./runtime-config')
    expect(validateProductionConfig).not.toThrow()
  })
})
