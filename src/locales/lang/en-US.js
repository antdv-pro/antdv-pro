import enUS from 'ant-design-vue/es/locale/en_US'

const enUSModules = import.meta.glob([
  '~/locales/lang/**/en-US.js',
  '~/pages/**/locales/en-US.js',
], {
  eager: true,
})
const messages = {}
for (const item in enUSModules) {
  const locale = enUSModules[item]?.default
  if (locale)
    Object.assign(messages, locale)
}
export default {
  ...messages,
  antd: enUS,
}
