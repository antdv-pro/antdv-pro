import type { ExtractPropTypes, VNodeChild } from 'vue'
import { arrayType, booleanType, eventType, numberType, stringType } from '@v-c/utils'

export type MenuData = MenuDataItem[]

export interface MenuDataItem {
  title: string | (() => VNodeChild)
  icon?: string
  path: string
  children?: MenuDataItem[]
  hideInMenu?: boolean
  parentKeys?: string[]
}

export type LayoutType = 'mix' | 'side' | 'top'

export type ThemeType = 'light' | 'dark' | 'inverted'

export type ContentWidth = 'Fluid' | 'Fixed'

export const proLayoutProps = {
  layout: stringType<LayoutType>('mix'),
  logo: stringType('https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg'),
  title: stringType('Antdv Admin Pro'),
  collapsedWidth: numberType(48),
  siderWidth: numberType(234),
  headerHeight: numberType(48),
  menuData: arrayType<MenuData>(),
  fixedHeader: booleanType<boolean>(false),
  fixedSider: booleanType<boolean>(true),
  splitMenus: booleanType(),
  collapsed: booleanType<boolean>(false),
  theme: stringType<ThemeType>('light'),
  onCollapsed: eventType<(collapsed: boolean) => void>(),
  isMobile: booleanType(),
  contentWidth: stringType<'ContentWidth'>(),
  header: booleanType<boolean>(true),
  footer: booleanType<boolean>(true),
  menu: booleanType<boolean>(true),
  menuHeader: booleanType<boolean>(true),
}

export type ProLayoutProps = Partial<ExtractPropTypes<typeof proLayoutProps>>
