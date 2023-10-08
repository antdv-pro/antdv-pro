import { runEvent } from '@v-c/utils'
import type { SelectEventHandler } from 'ant-design-vue/es/menu/src/interface'
import type { Key, MenuData, MenuDataItem, ProLayoutProps } from './typing'

export interface ProLayoutProviderMethods {
  handleCollapsed?: (collapsed: boolean) => void
}

function layoutStateFunc(props: ProLayoutProps, methods: ProLayoutProviderMethods = {}) {
  const hasPageContainer = shallowRef(false)
  const logo = computed(() => props.logo)
  const title = computed(() => props.title)
  const layout = computed(() => props.layout)
  const collapsedWidth = computed(() => props.collapsedWidth)
  const siderWidth = computed(() => props.siderWidth)
  const menuData = computed(() => props.menuData)
  const splitMenus = computed(() => props.splitMenus)
  const fixedHeader = computed(() => props.fixedHeader)
  const fixedSider = computed(() => props.fixedSider)
  const collapsed = computed(() => props.collapsed)
  const theme = computed(() => props.theme)
  const headerHeight = computed(() => props.headerHeight)
  const contentWidth = computed(() => props.contentWidth)
  const copyright = computed(() => props.copyright)
  /**
   * 移动端的处理方式
   */
  const isMobile = computed(() => props.isMobile)
  const mobileCollapsed = shallowRef(false)
  const handleMobileCollapsed = () => {
    mobileCollapsed.value = !mobileCollapsed.value
  }

  const header = computed(() => props.header)
  const menu = computed(() => props.menu)
  const footer = computed(() => props.footer)
  const menuHeader = computed(() => props.menuHeader)
  const leftCollapsed = computed(() => props.leftCollapsed)

  const menuDataMap = reactive(new Map<Key, MenuDataItem>())
  const splitState = reactive<{
    selectedKeys: Key[]
  }>({
    selectedKeys: [],
  })
  watch(
    menuData,
    () => {
      menuDataMap.clear()
      menuData.value?.forEach((item) => {
        menuDataMap.set(item.path, item)
      })
    },
    {
      immediate: true,
    },
  )
  const selectedMenus = computed(() => {
    if (isMobile.value || layout.value !== 'mix' || !splitMenus.value)
      return menuData.value
    const key = splitState.selectedKeys?.[0]
    if (!key)
      return []

    return menuDataMap.get(key)?.children ?? []
  })

  const handleSplitSelectedKeys = (val: Key[]) => {
    splitState.selectedKeys = val
    // runEvent(props['onUpdate:openKeys'], val)
  }
  /**
   * 菜单选中处理
   */
  const openKeys = computed(() => props.openKeys)
  const selectedKeys = computed(() => props.selectedKeys)
  const handleOpenKeys = (val: Key[]) => {
    runEvent(props['onUpdate:openKeys'], val)
  }

  const handleSelectedKeys = (val: Key[]) => {
    runEvent(props['onUpdate:selectedKeys'], val)
  }

  const handleMenuSelect: SelectEventHandler = (data) => {
    runEvent(props.onMenuSelect, data)
  }

  const findSelected = (key: Key, menuData: MenuData, pItem?: MenuDataItem): MenuDataItem | undefined => {
    for (const item of menuData ?? []) {
      if (item.path === key)
        return pItem ?? item
      if (item.children && item.children.length) {
        const find = findSelected(key, item.children, pItem ?? item)
        if (find)
          return find
      }
    }
  }

  watch(
    selectedKeys,
    () => {
      if (splitMenus.value) {
        const key = selectedKeys.value?.[0]

        if (key) {
          const find = findSelected(key, menuData.value ?? [])
          if (find)
            splitState.selectedKeys = [find.path]
        }
      }
    },
    {
      immediate: true,
    },
  )
  watch(splitMenus, () => {
    if (!splitMenus.value) {
      splitState.selectedKeys = []
    }
    else {
      const key = selectedKeys.value?.[0] ?? openKeys.value?.[0] ?? ''
      const find = findSelected(key, menuData.value ?? [])
      if (find)
        splitState.selectedKeys = [find?.path]
      else splitState.selectedKeys = []
    }
  })
  return {
    logo,
    title,
    layout,
    collapsed,
    leftCollapsed,
    collapsedWidth,
    menuData,
    siderWidth,
    fixedHeader,
    fixedSider,
    headerHeight,
    theme,
    isMobile,
    mobileCollapsed,
    contentWidth,
    copyright,
    hasPageContainer,
    splitMenus,
    splitState,
    menuDataMap,
    selectedMenus,
    handleMobileCollapsed,
    header,
    menu,
    footer,
    openKeys,
    handleOpenKeys,
    selectedKeys,
    handleSelectedKeys,
    handleMenuSelect,
    handleSplitSelectedKeys,
    menuHeader,
    ...methods,
  }
}

const [useLayoutProvider, useLayoutInject] = createInjectionState(layoutStateFunc)

export { useLayoutProvider }

export const useLayoutState = (): ReturnType<typeof layoutStateFunc> => useLayoutInject()!
