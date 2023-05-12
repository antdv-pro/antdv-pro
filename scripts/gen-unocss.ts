import path from 'path'
import { theme } from 'ant-design-vue'
import lodash from 'lodash'
import fsExtra from 'fs-extra'

const { defaultAlgorithm, defaultSeed } = theme

const mapToken = defaultAlgorithm(defaultSeed)

const formatKey = (key: string, prefixCls: string) => {
  return `${prefixCls}${lodash.kebabCase(key)}`
}
const prefixCls = '--pro-ant-'

const variables: {
  colors: Record<string, any>
} = {
  colors: {},
}
let colorTheme = ''
for (const key in mapToken) {
  if (key.startsWith('color')) {
    const cssVar = formatKey(key, prefixCls)
    const colors = variables.colors
    const themeKey = lodash.camelCase(key.slice(5))
    colors[themeKey] = `var(${cssVar})`
    colorTheme += `${themeKey}\n`
  }
}

fsExtra.outputFile(path.resolve(process.cwd(), './themes/antd-uno-theme.json'), JSON.stringify(variables, null, 2))

fsExtra.outputFile(path.resolve(process.cwd(), './themes/color-theme-var.md'), colorTheme)
