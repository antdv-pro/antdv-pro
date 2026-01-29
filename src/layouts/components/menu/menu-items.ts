import type { MenuProps } from 'antdv-next'
import type { MenuDataItem } from '~@/layouts/basic-layout/typing'
import { isUrl } from '@v-c/utils'
import { h } from 'vue'
import AsyncIcon from './async-icon.vue'

type MenuItems = NonNullable<MenuProps['items']>
type MenuItem = NonNullable<MenuItems>[number] & {
  path?: string
  target?: MenuDataItem['target']
  link?: boolean
  isUrl?: boolean
  label?: MenuDataItem['title']
}

function resolveLink(link: boolean | ((item: MenuDataItem) => boolean), item: MenuDataItem) {
  return typeof link === 'function' ? link(item) : link
}

export function createMenuItems(
  items: MenuDataItem[],
  options: { link?: boolean | ((item: MenuDataItem) => boolean) } = {},
): MenuItems {
  const { link = true } = options
  return (items ?? [])
    .filter(item => !item.hideInMenu)
    .map((item) => {
      const children = (item.children ?? []).filter(child => !child.hideInMenu)
      const hasChildren = children.length > 0 && !item.hideChildrenInMenu
      const menuItem: MenuItem = {
        key: item.path,
        label: item.title,
        icon: item.icon ? h(AsyncIcon, { icon: item.icon }) : undefined,
        children: hasChildren ? createMenuItems(children, { link }) : undefined,
        path: item.path,
        target: item.target,
        link: resolveLink(link, item),
        isUrl: isUrl(item.path),
      }
      return menuItem
    })
}
