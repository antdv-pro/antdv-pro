import dynamicRoutes, { rootRoute } from '~@/router/dynamic-routes'

export const useUserStore = defineStore('user', () => {
  const routerData = shallowRef()
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
  }
})
