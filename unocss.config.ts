import path from 'node:path'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import presetChinese from 'unocss-preset-chinese'
import presetEase from 'unocss-preset-ease'
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'
import { icons as vscodeIcons } from '@iconify-json/vscode-icons'
import antdUnoTheme from './themes/antd-uno-theme.json'

/**
 * 如果你想做动态加载 svg 显然 unocss 是不明智的，动态像svg demo 中通过计算属性等其他情况拼接
 * 由于 UnoCSS 在构建时使用静态提取，在编译时我们不可能知道所有实用程序的组合 因此需要提前注册
 * https://unocss.dev/guide/extracting#safelist
 * 这样带来的问题会将包体积将会变大
 * 如果你并不是需要动态加载svg 记住请移除这个配置，包整体测算导入一个vscodeIcons 图标集的包多出6MB
 */
const safeVscodeIconsList = Object.keys(vscodeIcons.icons).map(
  icon => `i-${vscodeIcons.prefix}:${icon}`,
).splice(0, 20)

export default defineConfig({
  safelist: [...safeVscodeIconsList],
  theme: {
    ...antdUnoTheme,
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetChinese(),
    presetEase(),
    presetTypography(),
    presetIcons({
      scale: 1.2,
      warn: true,
      collections: {
        custom: FileSystemIconLoader(
          path.resolve(__dirname, 'src/assets/icons'),
        ),
      },
    }),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
    }),
  ],
  shortcuts: [
    ['flex-center', 'flex items-center justify-center'],
    ['flex-between', 'flex items-center justify-between'],
    ['flex-end', 'flex items-end justify-between'],
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
})
