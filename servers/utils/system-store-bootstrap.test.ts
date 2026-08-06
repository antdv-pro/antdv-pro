import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bootstrapped: false,
  passwordSalt: '64590dd19edf7c2e',
  passwordHash: '852c4d3cff346ac3987f0cd7994edbe850bec6e6091ecbe56b5aecd7645dd592',
  execute: vi.fn(),
  connectionQuery: vi.fn(),
  poolQuery: vi.fn(),
}))

function userRow() {
  return {
    id: 1,
    username: 'admin',
    nickname: '超级管理员',
    mobile: null,
    email: null,
    company_id: 1,
    company_name: '测试公司',
    dept_id: 4,
    dept_name: '综合管理部',
    post_id: 1,
    post_name: '系统管理员',
    leader_user_id: null,
    leader_name: null,
    status: 'enabled',
    password_salt: mocks.passwordSalt,
    password_hash: mocks.passwordHash,
    last_login_at: null,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    role_codes: 'ADMIN',
    role_ids: '1',
  }
}

const connection = {
  execute: mocks.execute,
  query: mocks.connectionQuery,
}
const pool = {
  query: mocks.poolQuery,
  execute: vi.fn(),
}

vi.mock('node:fs', () => ({ existsSync: () => false, readFileSync: vi.fn(), writeFileSync: vi.fn(), mkdirSync: vi.fn() }))
vi.mock('./mysql', () => ({
  getMysqlPool: () => pool,
  isDatabaseRequired: () => true,
  withMysqlTransaction: async (_db: any, handler: any) => handler(connection),
}))

describe('production administrator bootstrap', () => {
  afterEach(() => {
    delete process.env.ADMIN_INITIAL_PASSWORD
    vi.resetModules()
  })

  it('rotates the legacy fixed password and restores the ADMIN relation atomically', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'Strong-Bootstrap-Password-2026'
    mocks.bootstrapped = false
    mocks.passwordSalt = '64590dd19edf7c2e'
    mocks.passwordHash = '852c4d3cff346ac3987f0cd7994edbe850bec6e6091ecbe56b5aecd7645dd592'
    vi.clearAllMocks()
    mocks.poolQuery.mockImplementation(async () => [[userRow()]])
    mocks.connectionQuery
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{ id: 1 }]])
    mocks.execute.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('UPDATE sys_user SET password_salt')) {
        mocks.passwordSalt = params[0]
        mocks.passwordHash = params[1]
        mocks.bootstrapped = true
      }
      return [{}]
    })

    const { systemStore } = await import('./system-store')
    const user = await systemStore.getUserByUsername('admin')

    expect(mocks.bootstrapped).toBe(true)
    expect(user?.passwordHash).not.toBe('852c4d3cff346ac3987f0cd7994edbe850bec6e6091ecbe56b5aecd7645dd592')
    expect(systemStore.hashPassword('Strong-Bootstrap-Password-2026', user!.passwordSalt)).toBe(user!.passwordHash)
    expect(systemStore.hashPassword('admin', user!.passwordSalt)).not.toBe(user!.passwordHash)
    expect(mocks.execute).toHaveBeenCalledWith(
      'INSERT IGNORE INTO sys_user_role (user_id, role_id) VALUES (?, ?)',
      [1, 1],
    )
  })

  it('maps top-level departments to the company and nested departments to their parent department', async () => {
    vi.clearAllMocks()
    mocks.poolQuery
      .mockResolvedValueOnce([[{ id: 1, parent_id: null, type: 'company', name: '测试公司', code: 'COMP001', leader_user_id: null, leader_name: null, sort_no: 0, status: 'enabled' }]])
      .mockResolvedValueOnce([[
        { id: 1, parent_id: 1, type: 'department', name: '总经办', code: 'DEPT001', leader_user_id: null, leader_name: null, sort_no: 10, status: 'enabled' },
        { id: 5, parent_id: 1, type: 'department', name: '运输管理部', code: 'DEPT005', leader_user_id: null, leader_name: null, sort_no: 20, status: 'enabled' },
      ]])
      .mockResolvedValueOnce([[{ id: 25, parent_id: 5, type: 'post', name: '监控员', code: 'POST025', leader_user_id: null, leader_name: null, sort_no: 1, status: 'enabled' }]])

    const { systemStore } = await import('./system-store')
    const organizations = await systemStore.listOrganizations()

    expect(organizations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '1', type: 'company', parentId: undefined }),
      expect.objectContaining({ id: '1', type: 'department', parentId: '1' }),
      expect.objectContaining({ id: '5', type: 'department', parentId: '1' }),
      expect.objectContaining({ id: '25', type: 'post', parentId: '5' }),
    ]))
    expect(mocks.poolQuery.mock.calls[1][0]).toContain('COALESCE(d.parent_id, d.company_id) AS parent_id')
  })
})
