import type { MenuData } from '~@/layouts/basic-layout/typing'
import dynamicRoutes, { rootRoute } from '~@/router/dynamic-routes'
import { genRoutes } from '~@/router/generate-route'

export const useUserStore = defineStore('user', () => {
  const routerData = shallowRef()
  const menuData = shallowRef<MenuData>([])
  const userInfo = reactive({
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
    username: 'admin',
    nickname: '超级管理员',
  })

  const avatar = computed(() => userInfo.avatar)
  const nickname = computed(() => userInfo.nickname ?? userInfo.username)

  const generateRoutes = async () => {
    const currentRoute = {
      ...rootRoute,
      children: dynamicRoutes,
    }
    menuData.value = genRoutes(dynamicRoutes)
    return currentRoute
  }

  const generateDynamicRoutes = async () => {
    const routerDatas = await generateRoutes()
    routerData.value = routerDatas
    return routerDatas
  }

  return {
    routerData,
    menuData,
    generateDynamicRoutes,
    avatar,
    nickname,
  }
})
