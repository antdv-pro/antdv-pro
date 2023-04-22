import router from '~/router'

router.beforeEach(async (to, _, next) => {
  // 获取
  const userStore = useUserStore()
  if (!userStore.routerData) {
    const currentRoute = await userStore.generateDynamicRoutes()
    await router.addRoute(currentRoute)
    next({
      ...to,
      replace: true,
    })
    return
  }
  next()
})

router.afterEach((to) => {
  // TODO
  const title = to.meta?.title
  if (title)
    document.title = title as string
})
