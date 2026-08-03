import { describe, expect, it, vi } from 'vitest'

import { checkMysqlConnection, getMysqlPool, isDatabaseRequired, requireMysql, withMysql, withMysqlTransaction } from './mysql'

const mocks = vi.hoisted(() => ({
  config: { database: { client: 'mysql', host: '', port: 3306, user: '', password: '', name: '', required: false } },
  pool: { on: vi.fn(), query: vi.fn() },
  createPool: vi.fn(),
}))
mocks.createPool.mockReturnValue(mocks.pool)
vi.mock('mysql2/promise', () => ({ default: { createPool: mocks.createPool } }))
vi.mock('./runtime-config', () => ({ runtimeConfig: mocks.config }))

describe('mysql runtime', () => {
  it('returns no pool for optional incomplete configuration', () => {
    expect(getMysqlPool()).toBeUndefined()
    expect(isDatabaseRequired()).toBe(false)
  })

  it('rejects incomplete configuration when the database is required', () => {
    mocks.config.database.required = true
    expect(getMysqlPool).toThrow('数据库未配置完整')
    mocks.config.database.required = false
  })

  it('creates and reuses one configured UTF-8 connection pool', () => {
    Object.assign(mocks.config.database, { host: 'db', user: 'app', password: 'secret', name: 'system' })
    expect(getMysqlPool()).toBe(mocks.pool)
    expect(getMysqlPool()).toBe(mocks.pool)
    expect(mocks.createPool).toHaveBeenCalledOnce()
    expect(mocks.createPool).toHaveBeenCalledWith(expect.objectContaining({ host: 'db', user: 'app', database: 'system', charset: 'utf8mb4', connectionLimit: 10 }))
    const connectionHandler = mocks.pool.on.mock.calls[0][1]
    const connection = { query: vi.fn() }
    connectionHandler(connection)
    expect(connection.query).toHaveBeenCalledWith('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci')
  })

  it('reports database readiness without exposing connection errors', async () => {
    mocks.pool.query.mockResolvedValueOnce([[{ value: 1 }]])
    await expect(checkMysqlConnection()).resolves.toEqual({ configured: true, ready: true })
    mocks.pool.query.mockRejectedValueOnce(new Error('secret connection detail'))
    await expect(checkMysqlConnection()).resolves.toEqual({ configured: true, ready: false })
  })

  it('executes optional and required database handlers', async () => {
    await expect(withMysql(async db => db === mocks.pool ? 'ok' : 'bad')).resolves.toBe('ok')
    await expect(requireMysql(async db => db === mocks.pool ? 42 : 0)).resolves.toBe(42)
  })

  it('commits successful transactions and always releases the connection', async () => {
    const connection = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }
    const transactionPool = { getConnection: vi.fn().mockResolvedValue(connection) } as any
    await expect(withMysqlTransaction(transactionPool, async db => db === connection ? 'done' : 'bad')).resolves.toBe('done')
    expect(connection.beginTransaction).toHaveBeenCalledOnce()
    expect(connection.commit).toHaveBeenCalledOnce()
    expect(connection.rollback).not.toHaveBeenCalled()
    expect(connection.release).toHaveBeenCalledOnce()
  })

  it('rolls back failed transactions and releases the connection', async () => {
    const connection = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }
    const transactionPool = { getConnection: vi.fn().mockResolvedValue(connection) } as any
    await expect(withMysqlTransaction(transactionPool, async () => {
      throw new Error('write failed')
    })).rejects.toThrow('write failed')
    expect(connection.commit).not.toHaveBeenCalled()
    expect(connection.rollback).toHaveBeenCalledOnce()
    expect(connection.release).toHaveBeenCalledOnce()
  })
})
