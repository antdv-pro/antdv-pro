import { AxiosError } from 'axios'
import { setRouteEmitter } from '~@/utils/route-listener'
import { useMetaTitle } from '~/composables/meta-title'
import router from '~/router'

const allowList = ['/login', '/error', '/401', '/404', '/403']
const loginPath = '/login'

router.beforeEach(async (to, _, next) => {
  setRouteEmitter(to)
  // 获取
  const userStore = useUserStore()
  const token = useAuthorization()
  if (!token.value) {
    //  如果token不存在就跳转到登录页面
    if (!allowList.includes(to.path) && !to.path.startsWith('/redirect')) {
      next({
        path: loginPath,
        query: {
          redirect: to.fullPath,
        },
      })
      return
    }
  }
  else {
    if (!userStore.routerData && !allowList.includes(to.path) && !to.path.startsWith('/redirect')) {
      try {
        // 用户信息与菜单互不依赖，并行恢复登录态，避免刷新时串行等待两个接口。
        const [, currentRoute] = await Promise.all([
          userStore.userInfo ? Promise.resolve() : userStore.getUserInfo(),
          userStore.generateDynamicRoutes(),
        ])
        router.addRoute(currentRoute)
        next({
          ...to,
          replace: true,
        })
        return
      }
      catch (e) {
        if (e instanceof AxiosError && e?.response?.status === 401) {
          // 跳转到error页面
          next({
            path: '/401',
          })
          return
        }
        next(false)
        return
      }
    }
    else {
      // 如果当前是登录页面就跳转到首页
      if (to.path === loginPath) {
        next({
          path: '/',
        })
        return
      }
    }
  }
  next()
})

router.afterEach((to) => {
  useMetaTitle(to)
  useLoadingCheck()
  useScrollToTop()
})
