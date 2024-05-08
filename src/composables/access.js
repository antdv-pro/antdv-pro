import { toArray } from '@v-c/utils'

export function useAccess() {
  const userStore = useUserStore()
  const roles = computed(() => userStore.roles)
  const hasAccess = (roles2) => {
    const accessRoles = userStore.roles
    const roleArr = toArray(roles2).flat(1)
    return roleArr.some(role => accessRoles?.includes(role))
  }
  return {
    hasAccess,
    roles,
  }
}
