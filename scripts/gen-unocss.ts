import path from 'node:path'
import { theme } from 'ant-design-vue'
import fsExtra from 'fs-extra'
import lodash from 'lodash'

const { defaultAlgorithm, defaultSeed } = theme

const mapToken = defaultAlgorithm(defaultSeed)

function formatKey(key: string, prefixCls: string) {
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

// eslint-disable-next-line node/prefer-global/process
fsExtra.outputFile(path.resolve(process.cwd(), './themes/antd-uno-theme.json'), JSON.stringify(variables, null, 2))

// eslint-disable-next-line node/prefer-global/process
fsExtra.outputFile(path.resolve(process.cwd(), './themes/color-theme-var.md'), colorTheme)
