import 'vue-router'

declare module 'vue-router'{
  import type { RouteRecordRaw } from 'vue-router'

  interface RouteMeta {
    title?: string
    icon?: string
    hideInMenu?: boolean
    parentKeys?: string[]
    isIframe?: boolean
    url?: string
    hideInBreadcrumb?: boolean
    hideChildrenInMenu?: boolean
    keepAlive?: boolean
    target?: '_blank' | '_self' | '_parent'
    affix?: boolean
    id?: string | number
    parentId?: string | number | null
    access?: (string | number)[]
    locale?: string
    parentName?: string
    parentComps?: RouteRecordRaw['component'][]
    originPath?: string
  }
}
