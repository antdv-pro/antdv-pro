import type { GlobalToken } from 'antdv-next/dist/theme/interface/cssinjs-utils'
import { canUseDom, updateCSS } from '@v-c/utils'

import { kebabCase } from 'lodash'

// type GlobalToken = ReturnType<typeof import('antdv-next').theme.useToken>['token']['value']

function formatKey(key: string, prefixCls: string) {
  return `${prefixCls}${kebabCase(key)}`
}
const prefixCls = '--ant-'

const dynamicStyleMark = `${prefixCls}${Date.now()}-${Math.random()}`

export function registerTokenToCSSVar(token: GlobalToken) {
  // TODO
  const variables: Record<string, any> = {}
  if (!token)
    return

  for (const key in token) {
    const val = token[key as keyof GlobalToken]
    variables[formatKey(key, prefixCls)] = val
  }
  const cssList = Object.keys(variables).map(key => `${key}: ${variables[key]};`)
  if (canUseDom()) {
    updateCSS(
      `:root {${cssList.join('\n')}}`,
      `${dynamicStyleMark}-dynamic-theme`,
    )
  }
}
