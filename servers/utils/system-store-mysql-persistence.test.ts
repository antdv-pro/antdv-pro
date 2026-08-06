import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  query: vi.fn(),
}))

const pool = { execute: mocks.execute, query: mocks.query }

vi.mock('node:fs', () => ({
  copyFileSync: vi.fn(),
  existsSync: () => false,
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))
vi.mock('./mysql', () => ({
  getMysqlPool: () => pool,
  isDatabaseRequired: () => true,
  withMysqlTransaction: async (_db: any, handler: any) => handler(pool),
}))

describe('system store MySQL persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sys_company')) {
        return [[{
          id: 1,
          parent_id: null,
          type: 'company',
          name: '测试公司',
          code: 'COMP001',
          leader_user_id: null,
          leader_name: null,
          sort_no: 0,
          status: 'enabled',
        }]]
      }
      if (sql.includes('FROM sys_dict')) {
        return [[{
          id: 1,
          type: 'fee_type',
          type_name: 'è´¹ç”¨ç±»åž‹',
          label: 'ä¿é™©è´¹',
          value: 'insurance',
          sort_no: 1,
          status: 'enabled',
          remark: null,
        }]]
      }
      return [[]]
    })
    mocks.execute.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO sys_user ('))
        return [{ insertId: 42 }]
      return [{}]
    })
  })

  it('inserts a newly created user instead of updating its temporary memory id', async () => {
    const { systemStore } = await import('./system-store')
    const user = await systemStore.saveUser({
      username: 'mysql-persistence-user',
      nickname: '持久化用户',
      mobile: '13900000000',
      roleIds: [],
      status: 'enabled',
    })

    expect(user.id).toBe(42)
    expect(mocks.execute.mock.calls.some(([sql]) => String(sql).includes('INSERT IGNORE INTO sys_dict'))).toBe(true)
    expect(mocks.execute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sys_user ('))).toBe(true)
    expect(mocks.execute.mock.calls.some(([sql]) => String(sql).includes('UPDATE sys_user'))).toBe(false)
  })

  it('repairs legacy mojibake dictionary fields read from MySQL', async () => {
    const { systemStore } = await import('./system-store')
    await expect(systemStore.listDictionaries({ type: 'fee_type' })).resolves.toEqual([
      expect.objectContaining({ typeName: '费用类型', label: '保险费' }),
    ])
  })
})
