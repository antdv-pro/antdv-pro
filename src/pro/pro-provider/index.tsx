
import type { ComputedRef, ExtractPropTypes, VNodeChild } from 'vue'
import type { VueKey } from '@v-c/utils'
import { booleanType, createInjectionState, objectType, omit, stringType } from '@v-c/utils'
import type { ConfigProviderProps } from 'ant-design-vue/es'
import { ConfigProvider as AntdConfigProvider, useCacheToken } from 'ant-design-vue/es'
import { configProviderProps, useConfigContextInject } from 'ant-design-vue/es/config-provider/context'
import zh_CN from 'ant-design-vue/es/locale/zh_CN'
import { computed } from 'vue'
import type { DeepPartial, ProTokenType } from './typing/layout-token'
import { defaultToken, emptyTheme } from './use-style/token'
import type { IntlType } from './intl'
import { findIntlKeyByAntdLocaleKey, intlMap, zhCNIntl } from './intl'
import { proTheme } from './use-style'
import { getLayoutDesignToken } from './typing/layout-token'
import { merge } from './utils/merge'
import type { ProAliasToken } from '~/pro/pro-provider/use-style'

export * from './use-style'
export * from './intl'

export { DeepPartial, ProTokenType }

/**
 * 用于配置 ValueEnum 的通用配置
 */
export interface ProSchemaValueEnumType {
  /** @name 演示的文案 */
  text: VNodeChild

  /** @name 预定的颜色 */
  status?: string
  /** @name 自定义的颜色 */
  color?: string
  /** @name 是否禁用 */
  disabled?: boolean
}

/**
 * 支持 Map 和 Object
 *
 * @name ValueEnum 的类型
 */
type ProSchemaValueEnumMap = Map<string | number, ProSchemaValueEnumType | VNodeChild>

/**
 * 支持 Map 和 Object
 */
type ProSchemaValueEnumObj = Record<string, ProSchemaValueEnumType | VNodeChild>

/**
 * BaseProFieldFC 的类型设置
 */
export interface BaseProFieldFC {
  /** 值的类型 */
  text: VNodeChild
  /** 放置到组件上 props */
  fieldProps?: any
  /**
     * 组件的渲染模式类型
     * @option read 渲染只读模式
     * @option edit 渲染编辑模式
     * */
  mode: ProFieldFCMode
  /**
     * 简约模式
     */
  plain?: boolean
  /** 轻量模式 */
  light?: boolean
  /** Label */
  label?: VNodeChild
  /** 映射值的类型 */
  valueEnum?: ProSchemaValueEnumObj | ProSchemaValueEnumMap
  /** 唯一的key，用于网络请求 */
  proFieldKey?: VueKey
}

export type ProFieldFCMode = 'read' | 'edit' | 'update'

/** Render 第二个参数，里面包含了一些常用的参数 */
export type ProFieldFCRenderProps = {
  mode?: ProFieldFCMode
  readonly?: boolean
  placeholder?: string | string[]
  value?: any
  onChange?: (...rest: any[]) => void
} & BaseProFieldFC

export interface ProRenderFieldPropsType {
  /**
     * 自定义只读模式的渲染器
     * @params props 关于dom的配置
     * @params dom 默认的 dom
     * @return 返回一个用于读的 dom
     */
  render?:
  | ((
    text: any,
    props: Omit<ProFieldFCRenderProps, 'value' | 'onChange'>,
    dom: VNodeChild,
  ) => VNodeChild)
  | undefined
  /**
     * 一个自定义的编辑渲染器。
     * @params text 默认的值类型
     * @params props 关于dom的配置
     * @params dom 默认的 dom
     * @return 返回一个用于编辑的dom
     */
  renderFormItem?:
  | ((text: any, props: ProFieldFCRenderProps, dom: VNodeChild) => VNodeChild)
  | undefined
}

export type ParamsType = Record<string, any>

export const proProviderProps = {
  autoClearCache: booleanType(false),
  token: objectType<DeepPartial<ProAliasToken>>(),
  needDeps: booleanType(),
  valueTypeMap: objectType<Record<string, ProRenderFieldPropsType>>(),
  dark: booleanType(),
  hashed: booleanType(),
  prefixCls: stringType(),
  hashId: stringType(),
  intl: objectType<Record<string, string>>(),
}

export type ProProviderProps = Partial<ExtractPropTypes<typeof proProviderProps>>

const proProviderStateFunc = (props: ComputedRef<ProProviderProps & ConfigProviderProps>) => {
  const intl = computed(() => props.value.intl)
  const hashed = computed(() => props.value.hashed)
  const dark = computed(() => props.value.dark)
  const hashId = computed(() => props.value.hashId)
  const prefixCls = computed(() => props.value.prefixCls)
  const valueTypeMap = computed(() => props.value.valueTypeMap)
  const token = computed(() => props.value.token)
  const theme = computed(() => props.value.theme)
  return {
    intl,
    hashed,
    hashId,
    dark,
    prefixCls,
    valueTypeMap,
    token,
    theme,
  }
}

const [useProProvider, useProProviderInject] = createInjectionState(proProviderStateFunc)

const defaultProProviderConfig = {
  intl: computed(() => ({
    ...zhCNIntl,
    locale: 'default',
  })),
  valueTypeMap: computed(() => ({})),
  theme: computed(() => emptyTheme),
  hashed: computed(() => true),
  dark: computed(() => false),
  token: computed(() => defaultToken as ProAliasToken),
  hashId: computed(() => undefined),
}

export const useProProviderContext = () => useProProviderInject() ?? defaultProProviderConfig

const ProProvider = defineComponent({
  name: 'ProProvider',
  inheritAttrs: false,
  props: {
    ...configProviderProps(),
    ...proProviderProps,
  },
  setup(props, { slots }) {
    const { getPrefixCls } = useConfigContextInject()
    const tokenContext = proTheme.useToken?.()

    /**
     * pro 的 类
     * @type {string}
     * @example .ant-pro
     */

    const proComponentsCls = computed(() => props.prefixCls ? `.${props.prefixCls}` : `.${getPrefixCls()}-pro`)

    const antCls = computed(() => `.${getPrefixCls()}`)

    const salt = computed(() => `${proComponentsCls.value}`)

    /**
     * 合并一下token，不然导致嵌套 token 失效
     */
    const proLayoutTokenMerge = computed(() => {
      return getLayoutDesignToken(props.token || {}, tokenContext.token.value || defaultToken)
    })

    const proProvideValue = computed(() => {
      const localeName = props.locale?.locale
      const key = findIntlKeyByAntdLocaleKey(localeName) as keyof typeof intlMap
      // antd 的 key 存在的时候以 antd 的为主
      const intl
          = localeName && props.intl?.locale === 'default'
            ? intlMap[key]
            : props.intl || intlMap[key]

      return {
        ...props,
        dark: props.dark,
        token: merge(props.token, tokenContext.token.value, {
          proComponentsCls: proComponentsCls.value,
          antCls: antCls.value,
          themeId: tokenContext.theme.value.id,
          layout: proLayoutTokenMerge.value,
        }),
        intl: intl || zhCNIntl,
      }
    })

    const finalToken = computed(() => ({
      ...(proProvideValue.value.token || {}),
      proComponentsCls: proComponentsCls.value,
    }))

    const cacheToken = useCacheToken<ProAliasToken>(
      tokenContext.theme,
      computed(() => [tokenContext.token.value, finalToken.value ?? {}]),
      computed(() => ({
        salt: salt.value,
      })),
    )

    const hashId = computed(() => {
      const nativeHashId = cacheToken.value?.[1]
      if (props.hashed === false)
        return ''

      if (process?.env.NODE_ENV?.toLowerCase() !== 'test') return nativeHashId
      return ''
    })

    useProProvider(proProvideValue as ComputedRef<ProProviderProps>)
    const mergeAlgorithm = () => {
      const isDark = props.dark ?? false
      if (isDark && !Array.isArray(props.theme?.algorithm))
        return [proTheme.darkAlgorithm, props.theme?.algorithm].filter(Boolean)

      if (isDark && Array.isArray(props.theme?.algorithm))
        return [proTheme.darkAlgorithm, ...(props.theme?.algorithm || [])].filter(Boolean)

      return props.theme?.algorithm
    }

    return () => {
      const rest = omit(props, [...Object.keys(proProviderProps) as any, 'locale', 'theme', 'hashId'])

      // 是不是不需要渲染 provide
      const isNullProvide
          = props.needDeps
          && props.hashId !== undefined
          && Object.keys(props).sort().join('-') === 'children-needDeps'
      if (isNullProvide)
        return slots.default?.()

      // 自动注入 antd 的配置
      const configProvider: any = {
        ...rest,
        locale: props.locale || zh_CN,
        theme: {
          ...props.theme,
          algorithm: mergeAlgorithm(),
        },
      }

      const themeConfig = {
        ...configProvider.theme,
        hashId: hashId.value,
        hashed:
            process?.env?.NODE_ENV?.toLowerCase() !== 'test'
            && props.hashed !== false,
      }
      return (
        <AntdConfigProvider {...configProvider} theme={themeConfig}>
          {slots.default?.()}
        </AntdConfigProvider>
      )
    }
  },
})

/**
 * It returns the intl object from the context if it exists, otherwise it returns the intl object for
 * 获取国际化的方法
 * @param locale
 * @param localeMap
 * the current locale
 * @returns The return value of the function is the intl object.
 */
export function useIntl(): ComputedRef<IntlType> {
  const { locale } = useConfigContextInject()
  const { intl } = useProProviderContext()

  return computed(() => {
    if (intl.value && intl.value.locale !== 'default')
      return intl.value || zhCNIntl

    if (locale?.value?.locale)
      return (intlMap as any)[findIntlKeyByAntdLocaleKey(locale.value.locale)] || zhCNIntl
    return zhCNIntl
  })
}

export default ProProvider
