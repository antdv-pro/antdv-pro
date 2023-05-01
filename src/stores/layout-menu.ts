import type { MenuData, MenuDataItem } from '~@/layouts/basic-layout/typing'

const toMapMenuData = (menuData: MenuData, menuDataMap: Map<string, MenuDataItem>, matched: MenuDataItem[] = []) => {
  menuData.forEach((v) => {
    menuDataMap.set(v.path, { ...v, matched })
    if (v.children && v.children.length)
      toMapMenuData(v.children, menuDataMap, [...matched, v])
  })
}

export const useLayoutMenu = defineStore('layout-menu', () => {
  const useStore = useUserStore()
  const appStore = useAppStore()
  const menuDataMap = reactive(new Map<string, MenuDataItem>())
  const route = useRoute()
  const selectedKeys = ref<string[]>([])
  const openKeys = ref<string[]>([])
  const proxyOpenKeys = shallowRef<string[]>()
  const changeMenu = () => {
    if (menuDataMap.has(route.path)) {
      const menu = menuDataMap.get(route.path)
      openKeys.value = []
      selectedKeys.value = []
      if (menu) {
        if (menu.parentKeys && menu.parentKeys.length)
          selectedKeys.value = menu.parentKeys
        else
          selectedKeys.value = [menu.path]
      }
      // 设置openkeys
      if (menu?.matched)
        openKeys.value = menu.matched.map(v => v.path)
    }
  }
  watch(() => useStore.menuData, (val) => {
    toMapMenuData(val, menuDataMap)
    changeMenu()
  }, { immediate: true, flush: 'post' })

  const handleSelectedKeys = (val: string[]) => {
    selectedKeys.value = val
  }

  const handleOpenKeys = (val: string[]) => {
    openKeys.value = val
  }

  watch(() => appStore.layoutSetting.layout, (layout) => {
    proxyOpenKeys.value = layout === 'top' ? [] : openKeys.value
  }, { immediate: true, flush: 'post' })

  return {
    selectedKeys,
    openKeys: proxyOpenKeys,
    handleSelectedKeys,
    handleOpenKeys,
    changeMenu,
  }
})
