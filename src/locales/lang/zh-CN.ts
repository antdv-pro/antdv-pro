import zhCN from 'ant-design-vue/es/locale/zh_CN'

const zhCNModules = import.meta.glob([
  '~/locales/lang/**/zh-CN.ts',
  '~/pages/**/locales/zh-CN.ts',
], {
  eager: true,
})

const messages = {}

for (const item in zhCNModules) {
  const locale = (zhCNModules[item] as any)?.default
  if (locale)
    Object.assign(messages, locale)
}
export default {
  ...messages,
  antd: zhCN,
}
