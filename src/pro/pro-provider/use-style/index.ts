import type { CSSInterpolation, CSSObject } from 'ant-design-vue/es/_util/cssinjs'
import { useStyleRegister } from 'ant-design-vue/es/_util/cssinjs'
import { TinyColor } from '@ctrl/tinycolor'

import { theme as antdTheme } from 'ant-design-vue/es'
import type { GlobalToken } from 'ant-design-vue/es/theme/interface'
import { useConfigContextInject } from 'ant-design-vue/es/config-provider/context'
import type { VNodeChild } from 'vue'
import { computed } from 'vue'
import type { ProTokenType } from '../typing/layout-token'
import * as batToken from './token'
import { useProProviderContext } from '~/pro/pro-provider'

/**
 * 把一个颜色设置一下透明度
 * @example (#fff, 0.5) => rgba(255, 255, 255, 0.5)
 * @param baseColor {string}
 * @param alpha {0-1}
 * @returns rgba {string}
 */
export const setAlpha = (baseColor: string, alpha: number) =>
  new TinyColor(baseColor).setAlpha(alpha).toRgbString()

/**
 * 把一个颜色修改一些明度
 * @example (#000, 50) => #808080
 * @param baseColor {string}
 * @param brightness {0-100}
 * @returns hexColor {string}
 */
export const lighten = (baseColor: string, brightness: number) => {
  const instance = new TinyColor(baseColor)
  return instance.lighten(brightness).toHexString()
}

export type GenerateStyle<
  ComponentToken extends object = GlobalToken,
  ReturnType = CSSInterpolation,
> = (token: ComponentToken) => ReturnType

const genTheme = (): typeof antdTheme => {
  if (typeof antdTheme === 'undefined' || !antdTheme) return batToken as any
  return antdTheme
}

export const proTheme = genTheme()

export const useToken = proTheme.useToken

export interface UseStyleResult {
  wrapSSR: (node: VNodeChild) => VNodeChild
  hashId: string
}

export type ProAliasToken = GlobalToken &
ProTokenType & {
  themeId: number
  /**
     * pro 的 className
     * @type {string}
     * @example .ant-pro
     */
  proComponentsCls: string
  /**
     * antd 的 className
     * @type {string}
     * @example .ant
     */
  antCls: string
}

export const resetComponent = (token: ProAliasToken): CSSObject => ({
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
  color: token.colorText,
  fontSize: token.fontSize,
  lineHeight: token.lineHeight,
  listStyle: 'none',
})

export const operationUnit = (token: ProAliasToken): CSSObject => ({
  // FIXME: This use link but is a operation unit. Seems should be a colorPrimary.
  // And Typography use this to generate link style which should not do this.
  'color': token.colorLink,
  'outline': 'none',
  'cursor': 'pointer',
  'transition': `color ${token.motionDurationSlow}`,

  '&:focus, &:hover': {
    color: token.colorLinkHover,
  },

  '&:active': {
    color: token.colorLinkActive,
  },
})

/**
 * 封装了一下 antd 的 useStyle，支持了一下antd@4
 * @param componentName {string} 组件的名字
 * @param styleFn {GenerateStyle} 生成样式的函数
 * @returns UseStyleResult
 */
export function useStyle(
  componentName: string,
  styleFn: (token: ProAliasToken) => CSSInterpolation,
) {
  const { token, hashId, theme } = useProProviderContext()
  const { token: antdToken } = useToken()
  const { getPrefixCls } = useConfigContextInject()

  const info = computed(() => {
    let mergedToken: Record<string, any> = { ...token.value }
    if (token.value)
      mergedToken.antCls = `.${getPrefixCls()}`

    // 如果不在 ProProvider 里面，就用 antd 的

    if (!token.value?.layout) {
      mergedToken = { ...antdToken.value }
      if (token.value)
        mergedToken.proComponentsCls = token.value.proComponentsCls ?? `.${getPrefixCls('pro')}`
    }
    return {
      token,
      theme: theme.value,
      hashId: hashId.value,
      path: [componentName],
    }
  })

  return {
    wrapSSR: useStyleRegister(
      info as any,
      () => styleFn(token.value as ProAliasToken),
    ),
    hashId,
  }
}
