import type { MenuData, MenuDataItem } from '~@/layouts/basic-layout/typing'
import { isUrl } from '@v-c/utils'
import router from '~@/router'
import { deepFind } from '~@/utils/tree'

function toMapMenuData(menuData: MenuData, menuDataMap: Map<string, MenuDataItem>, matched: MenuDataItem[] = []) {
  menuData.forEach((v) => {
    menuDataMap.set(v.path, { ...v, matched })
    if (v.children && v.children.length)
      toMapMenuData(v.children, menuDataMap, [...matched, v])
  })
}

export const useLayoutMenu = defineStore('layout-menu', () => {
  const userStore = useUserStore()
  const appStore = useAppStore()
  const { layoutSetting } = storeToRefs(appStore)
  const menuDataMap = reactive(new Map<string, MenuDataItem>())
  const selectedKeys = ref<string[]>([])
  const openKeys = ref<string[]>([])
  const changeMenu = () => {
    const route = router.currentRoute.value
    const path = route.meta?.originPath ?? route.path
    if (menuDataMap.has(path)) {
      const menu = menuDataMap.get(path)
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
        if (!layoutSetting.value.accordionMode)
          openKeys.value = [...new Set([...openKeys.value, ...newOpenKeys])]
        else
          openKeys.value = newOpenKeys
      }
    }
  }
  watch(() => userStore.menuData, (val) => {
    toMapMenuData(val, menuDataMap)
    changeMenu()
  }, { immediate: true, flush: 'post' })

  const { menuData } = storeToRefs(userStore)
  const findMenuByPath: any = (path: string) => (obj: MenuData) =>
    deepFind(o => o.path === path)(obj)
  const handleAccordionMode = (innerOpenKeys: string[]) => {
    const rootSubmenuKeys: string[] | undefined = menuData.value?.map((item) => {
      return item.path
    })
    const latestOpenKey = innerOpenKeys.find(key => !openKeys.value.includes(key))
    if (latestOpenKey) {
      if (!rootSubmenuKeys.includes(latestOpenKey)) {
        // 与 前一项比较 是否为同一级，同级则移除前一项
        const prevKey = innerOpenKeys[innerOpenKeys.length - 2]
        const preMenuItem = findMenuByPath(prevKey)(menuData.value)
        const latestOpenMenuItem = findMenuByPath(latestOpenKey)(menuData.value)
        if (preMenuItem && latestOpenMenuItem && preMenuItem.parentId === latestOpenMenuItem.parentId)
          innerOpenKeys.splice(innerOpenKeys.indexOf(prevKey), 1)
        openKeys.value = innerOpenKeys
      }
      else {
        openKeys.value = [latestOpenKey]
      }
    }
    else {
      openKeys.value = innerOpenKeys
    }
  }

  const handleSelectedKeys = (val: string[]) => {
    // 如果点击的是外部的菜单，那么我们就不需要设置成为激活的状态
    const path = val[0]
    if (!isUrl(path))
      selectedKeys.value = val
  }

  const handleOpenKeys = (val: string[]) => {
    if (layoutSetting.value.accordionMode)
      handleAccordionMode(val)
    else
      openKeys.value = val
  }

  watch(router.currentRoute, (route) => {
    // 路由发生变化
    if (route.path === selectedKeys.value[0])
      return
    changeMenu()
  })

  const clear = () => {
    openKeys.value = []
    selectedKeys.value = []
  }

  return {
    selectedKeys,
    openKeys,
    menuDataMap,
    handleSelectedKeys,
    handleOpenKeys,
    changeMenu,
    handleAccordionMode,
    clear,
  }
})
