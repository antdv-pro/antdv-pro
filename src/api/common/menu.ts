import type { MenuData } from '~@/layouts/basic-layout/typing'

export function getRouteMenusApi() {
  return useGet<MenuData>('/menu')
}
