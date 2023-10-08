import type { RouteLocationNormalizedLoaded } from 'vue-router'
import router from '~@/router'

const allowList = ['/login', '/404', '/403']

export interface MultiTabItem {
  path: string
  fullPath: string
  title: string
  name?: string
  icon?: string
  locale?: string
  // 判断当前是不是一个固定的标签
  affix?: boolean
  loading?: boolean
}

export const useMultiTab = defineStore('multi-tab', () => {
  const list = ref<MultiTabItem[]>([])
  const activeKey = shallowRef()
  const refreshItem = ref<MultiTabItem | null>(null)
  const appStore = useAppStore()
  const cacheList = ref<string[]>([])
  const message = useMessage()
  const addItem = (route: RouteLocationNormalizedLoaded) => {
    if (!route)
      return
    // 判断是不是重定向的地址，如果是，那么久不进行处理
    if (route.path.startsWith('/redirect') || route.path.startsWith('/common'))
      return
    if (route.path === '/')
      return
    if (allowList.includes(route.path))
      return
    // 设置当前的loading为false
    if (refreshItem.value) {
      // 增加一个取消的延迟
      setTimeout(() => {
        if (refreshItem.value) {
          refreshItem.value.loading = false
          refreshItem.value = null
        }
      }, 500)
    }
    if (list.value.some(item => item.fullPath === route.fullPath)) {
      if (!cacheList.value.includes(route?.name as string) && appStore.layoutSetting.keepAlive) {
        if (route.meta.keepAlive && route.name)
          cacheList.value.push(route.name as string)
      }
      return
    }
    const item: MultiTabItem = {
      path: route.path,
      fullPath: route.fullPath,
      title: route.meta.title as string,
      name: route.name as string,
      icon: route.meta.icon,
      affix: route.meta.affix,
      locale: route.meta.locale,
    }
    if (!cacheList.value.includes(item?.name as string) && appStore.layoutSetting.keepAlive) {
      if (route.meta.keepAlive && route.name)
        cacheList.value.push(route.name as string)
    }

    list.value.push(item)
  }

  const close = (key: string) => {
    // 判断长度是不是小于等于1，如果是那么这个就不能被关闭
    if (list.value.length <= 1) {
      message.error('不能关闭最后一个标签页')
      return
    }
    const index = list.value.findIndex(item => item.fullPath === key)
    if (index < 0) {
      message.error('当前页签不存在无法关闭')
      return
    }
    const item = list.value[index]
    // 需要判断当前的标签是不是被选中，如果是，还需要判断当前是不是第一个页签，如果是，那么久需要激活上一个页签，如果不是，那就需要激活下一个页签
    if (item.fullPath === activeKey.value) {
      const newItem = index === 0 ? list.value[index + 1] : list.value[index - 1]
      activeKey.value = newItem.fullPath
      router.push(newItem.fullPath)
    }
    // 去除缓存
    if (appStore.layoutSetting.keepAlive && item.name)
      cacheList.value = cacheList.value.filter(name => name !== item.name)

    list.value = list.value.filter(item => item.fullPath !== key)
  }

  const refresh = (key: string) => {
    const item = list.value.find(item => item.fullPath === key)
    if (item) {
      cacheList.value = cacheList.value.filter(name => name !== item.name)
      item.loading = true
      refreshItem.value = item
      router.replace(`/redirect/${encodeURIComponent(item.fullPath)}`)
    }
  }

  const switchTab = (key: string) => {
    if (key === activeKey.value)
      return
    router.push(key)
  }

  const closeOther = (key: string) => {
    switchTab(key)
    list.value.forEach((item) => {
      if (item.affix)
        return
      if (item.fullPath === key)
        return
      close(item.fullPath)
    })
  }

  const closeLeft = (key: string) => {
    switchTab(key)

    const index = list.value.findIndex(item => item.fullPath === key)
    const leftList = list.value.slice(0, index)
    leftList.forEach((item) => {
      if (item.affix)
        return
      close(item.fullPath)
    })
  }

  const closeRight = (key: string) => {
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
    activeKey.value = undefined
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
