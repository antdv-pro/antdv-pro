import { kebabCase } from 'lodash'
import { canUseDom, updateCSS } from '@v-c/utils'

function formatKey(key, prefixCls2) {
  return `${prefixCls2}${kebabCase(key)}`
}
const prefixCls = '--pro-ant-'
const dynamicStyleMark = `${prefixCls}${Date.now()}-${Math.random()}`
export function registerTokenToCSSVar(token) {
  const variables = {}
  if (!token)
    return
  for (const key in token) {
    const val = token[key]
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
