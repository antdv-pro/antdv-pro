import dynamicRoutes, { rootRoute } from '~@/router/dynamic-routes'

export const useUserStore = defineStore('user', () => {
  const routerData = shallowRef()
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
    return currentRoute
  }

  const generateDynamicRoutes = async () => {
    const routerDatas = await generateRoutes()
    routerData.value = routerDatas
    return routerDatas
  }

  return {
    routerData,
    generateDynamicRoutes,
    avatar,
    nickname,
  }
})
