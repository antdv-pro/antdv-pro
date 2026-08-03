import { describe, expect, it, vi } from 'vitest'

import { useAccess } from './access'

const store = vi.hoisted(() => ({ roles: ['ADMIN', 2] as Array<string | number> }))
vi.mock('~@/stores/user', () => ({ useUserStore: () => store }))

describe('useAccess', () => {
  it('accepts scalar and array roles and rejects missing access', () => {
    const { hasAccess, roles } = useAccess()
    expect(hasAccess('ADMIN')).toBe(true)
    expect(hasAccess(['USER', 2])).toBe(true)
    expect(hasAccess('AUDITOR')).toBe(false)
    expect(roles.value).toEqual(['ADMIN', 2])
  })
})
