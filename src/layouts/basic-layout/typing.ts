import type { VNodeChild } from 'vue'

export type MenuData = MenuDataItem[]

export interface MenuDataItem {
  title: string | (() => VNodeChild)
  icon?: string
  path: string
  children?: MenuDataItem[]
  hideInMenu?: boolean
  parentKeys?: string[]
}
