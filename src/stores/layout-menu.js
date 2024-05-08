import { isUrl } from '@v-c/utils'
import router from '~@/router'
import { deepFind } from '~@/utils/tree'

function toMapMenuData(menuData, menuDataMap, matched = []) {
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
  const menuDataMap = reactive(/* @__PURE__ */ new Map())
  const selectedKeys = ref([])
  const openKeys = ref([])
  const changeMenu = () => {
    const route = router.currentRoute.value
    const path = route.meta?.originPath ?? route.path
    if (menuDataMap.has(path)) {
      const menu = menuDataMap.get(path)
      selectedKeys.value = []
      if (menu) {
        if (menu.parentKeys && menu.parentKeys.length)
          selectedKeys.value = menu.parentKeys
        else
          selectedKeys.value = [menu.path]
      }
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
  const findMenuByPath = path => obj => deepFind(o => o.path === path)(obj)
  const handleAccordionMode = (innerOpenKeys) => {
    const rootSubmenuKeys = menuData.value?.map((item) => {
      return item.path
    })
    const latestOpenKey = innerOpenKeys.find(key => !openKeys.value.includes(key))
    if (latestOpenKey) {
      if (!rootSubmenuKeys.includes(latestOpenKey)) {
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
  const handleSelectedKeys = (val) => {
    const path = val[0]
    if (!isUrl(path))
      selectedKeys.value = val
  }
  const handleOpenKeys = (val) => {
    if (layoutSetting.value.accordionMode)
      handleAccordionMode(val)
    else
      openKeys.value = val
  }
  watch(router.currentRoute, (route) => {
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
