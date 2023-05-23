import { isUrl } from '@v-c/utils'
import type { MenuData, MenuDataItem } from '~@/layouts/basic-layout/typing'
import router from '~@/router'

const toMapMenuData = (menuData: MenuData, menuDataMap: Map<string, MenuDataItem>, matched: MenuDataItem[] = []) => {
  menuData.forEach((v) => {
    menuDataMap.set(v.path, { ...v, matched })
    if (v.children && v.children.length)
      toMapMenuData(v.children, menuDataMap, [...matched, v])
  })
}

export const useLayoutMenu = defineStore('layout-menu', () => {
  const useStore = useUserStore()
  const menuDataMap = reactive(new Map<string, MenuDataItem>())
  const selectedKeys = ref<string[]>([])
  const openKeys = ref<string[]>([])
  const changeMenu = () => {
    const route = router.currentRoute.value
    if (menuDataMap.has(route.path)) {
      const menu = menuDataMap.get(route.path)
      // openKeys.value = []
      selectedKeys.value = []
      if (menu) {
        if (menu.parentKeys && menu.parentKeys.length)
          selectedKeys.value = menu.parentKeys
        else
          selectedKeys.value = [menu.path]
      }
      // 设置openkeys
      if (menu?.matched) {
        const newOpenKeys = menu.matched.map(v => v.path)
        openKeys.value = [...new Set([...openKeys.value, ...newOpenKeys])]
      }
    }
  }
  watch(() => useStore.menuData, (val) => {
    toMapMenuData(val, menuDataMap)
    changeMenu()
  }, { immediate: true, flush: 'post' })

  const handleSelectedKeys = (val: string[]) => {
    // 如果点击的是外部的菜单，那么我们就不需要设置成为激活的状态
    const path = val[0]
    if (!isUrl(path))
      selectedKeys.value = val
  }

  const handleOpenKeys = (val: string[]) => {
    openKeys.value = val
  }

  watch(router.currentRoute, (route) => {
    // 路由发生变化
    if (route.path === selectedKeys.value[0]) return
    changeMenu()
  })

  return {
    selectedKeys,
    openKeys,
    menuDataMap,
    handleSelectedKeys,
    handleOpenKeys,
    changeMenu,
  }
})
