import type { RouteLocationNormalizedLoaded } from 'vue-router'
import router from '~@/router'

export interface MultiTabItem {
  path: string
  fullPath: string
  title: string
  name?: string
  icon?: string
  // 判断当前是不是一个固定的标签
  affix?: boolean
  loading?: boolean
}

export const useMultiTab = defineStore('multi-tab', () => {
  const list = ref<MultiTabItem[]>([])
  const activeKey = shallowRef()
  const addItem = (route: RouteLocationNormalizedLoaded) => {
    if (!route) return
    if (list.value.some(item => item.fullPath === route.fullPath)) return
    const item: MultiTabItem = {
      path: route.path,
      fullPath: route.fullPath,
      title: route.meta.title as string,
      name: route.name as string,
      icon: route.meta.icon,
      affix: route.meta.affix,
    }
    list.value.push(item)
  }
  watch(router.currentRoute, (route) => {
    // TODO,选中使用全连接
    activeKey.value = route.fullPath
    addItem(route)
  }, { immediate: true })
  return {
    list,
    activeKey,
  }
})
