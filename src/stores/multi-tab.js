import router from '~@/router'

const allowList = ['/login', '/404', '/403']
export const useMultiTab = defineStore('multi-tab', () => {
  const list = ref([])
  const activeKey = shallowRef()
  const refreshItem = ref(null)
  const appStore = useAppStore()
  const cacheList = ref([])
  const message = useMessage()
  const addItem = (route) => {
    if (!route)
      return
    if (route.path.startsWith('/redirect') || route.path.startsWith('/common'))
      return
    if (route.path === '/')
      return
    if (allowList.includes(route.path))
      return
    if (refreshItem.value) {
      setTimeout(() => {
        if (refreshItem.value) {
          refreshItem.value.loading = false
          refreshItem.value = null
        }
      }, 500)
    }
    if (list.value.some(item2 => item2.fullPath === route.fullPath)) {
      if (!cacheList.value.includes(route?.name) && appStore.layoutSetting.keepAlive) {
        if (route.meta.keepAlive && route.name)
          cacheList.value.push(route.name)
      }
      return
    }
    const item = {
      path: route.path,
      fullPath: route.fullPath,
      title: route.meta.title,
      name: route.name,
      icon: route.meta.icon,
      affix: route.meta.affix,
      locale: route.meta.locale,
    }
    if (!cacheList.value.includes(item?.name) && appStore.layoutSetting.keepAlive) {
      if (route.meta.keepAlive && route.name)
        cacheList.value.push(route.name)
    }
    list.value.push(item)
  }
  const close = (key) => {
    if (list.value.length <= 1) {
      message.error('不能关闭最后一个标签页')
      return
    }
    const index = list.value.findIndex(item2 => item2.fullPath === key)
    if (index < 0) {
      message.error('当前页签不存在无法关闭')
      return
    }
    const item = list.value[index]
    if (item.fullPath === activeKey.value) {
      const newItem = index === 0 ? list.value[index + 1] : list.value[index - 1]
      activeKey.value = newItem.fullPath
      router.push(newItem.fullPath)
    }
    if (appStore.layoutSetting.keepAlive && item.name)
      cacheList.value = cacheList.value.filter(name => name !== item.name)
    list.value = list.value.filter(item2 => item2.fullPath !== key)
  }
  const refresh = (key) => {
    const item = list.value.find(item2 => item2.fullPath === key)
    if (item) {
      cacheList.value = cacheList.value.filter(name => name !== item.name)
      item.loading = true
      refreshItem.value = item
      router.replace(`/redirect/${encodeURIComponent(item.fullPath)}`)
    }
  }
  const switchTab = (key) => {
    if (key === activeKey.value)
      return
    router.push(key)
  }
  const closeOther = (key) => {
    switchTab(key)
    list.value.forEach((item) => {
      if (item.affix)
        return
      if (item.fullPath === key)
        return
      close(item.fullPath)
    })
  }
  const closeLeft = (key) => {
    switchTab(key)
    const index = list.value.findIndex(item => item.fullPath === key)
    const leftList = list.value.slice(0, index)
    leftList.forEach((item) => {
      if (item.affix)
        return
      close(item.fullPath)
    })
  }
  const closeRight = (key) => {
    switchTab(key)
    const index = list.value.findIndex(item => item.fullPath === key)
    const rightList = list.value.slice(index + 1)
    rightList.forEach((item) => {
      if (item.affix)
        return
      close(item.fullPath)
    })
  }
  const clear = () => {
    list.value = []
    cacheList.value = []
    activeKey.value = void 0
    refreshItem.value = null
  }
  return {
    list,
    activeKey,
    cacheList,
    close,
    clear,
    closeLeft,
    closeRight,
    closeOther,
    refresh,
    switchTab,
    addItem,
  }
})
