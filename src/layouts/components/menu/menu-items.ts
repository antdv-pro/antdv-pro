import type { MenuProps } from 'antdv-next'
import type { MenuDataItem } from '~@/layouts/basic-layout/typing'
import { isUrl } from '@v-c/utils'
import { omit } from 'lodash'

type MenuItems = NonNullable<MenuProps['items']>

export function createMenuItems(items: MenuDataItem[]): MenuItems {
  return (items ?? [])
    .filter(item => !item.hideInMenu)
    .map((item) => {
      const children = (item.children ?? []).filter(child => !child.hideInMenu)
      const hasChildren = children.length > 0 && !item.hideChildrenInMenu
      const menuItem: Record<string, any> = {
        ...omit(item, ['children']),
        key: item.path,
        label: item.title,
        path: item.path,
        target: item.target,
        isUrl: isUrl(item.path),
        icon: item.icon,
      }
      if (hasChildren) {
        menuItem.children = createMenuItems(children)
      }
      return menuItem as MenuItems[number]
    })
}
