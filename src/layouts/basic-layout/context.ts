import { runEvent } from '@v-c/utils'
import type { MenuSelectEvent, ProLayoutProps } from './typing'

export interface ProLayoutProviderMethods {
  handleCollapsed?: (collapsed: boolean) => void
}

const layoutStateFunc = (props: ProLayoutProps, methods: ProLayoutProviderMethods = {}) => {
  const hasPageContainer = shallowRef(false)
  const logo = computed(() => props.logo)
  const title = computed(() => props.title)
  const layout = computed(() => props.layout)
  const collapsedWidth = computed(() => props.collapsedWidth)
  const siderWidth = computed(() => props.siderWidth)
  const menuData = computed(() => props.menuData)
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

  /**
   * 菜单选中处理
   */
  const openKeys = computed(() => props.openKeys)
  const selectedKeys = computed(() => props.selectedKeys)
  const handleOpenKeys = (val: string[]) => {
    runEvent(props['onUpdate:openKeys'], val)
  }

  const handleSelectedKeys = (val: string[]) => {
    runEvent(props['onUpdate:selectedKeys'], val)
  }

  const handleMenuSelect = (data: MenuSelectEvent) => {
    runEvent(props.onMenuSelect, data)
  }
  return {
    logo,
    title,
    layout,
    collapsed,
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
    handleMobileCollapsed,
    header,
    menu,
    footer,
    openKeys,
    handleOpenKeys,
    selectedKeys,
    handleSelectedKeys,
    handleMenuSelect,
    menuHeader,
    ...methods,
  }
}

const [useLayoutProvider, useLayoutInject] = createInjectionState(layoutStateFunc)

export {
  useLayoutProvider,
}

export const useLayoutState = (): ReturnType<typeof layoutStateFunc> => useLayoutInject()!
