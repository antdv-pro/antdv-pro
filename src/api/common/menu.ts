import type { MenuData } from '~@/layouts/basic-layout/typing'

export const getRouteMenusApi = () => {
  return useGet<MenuData>('/menu')
}
