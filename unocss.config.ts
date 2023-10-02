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

// 由于 UnoCSS 在构建时使用静态提取，在编译时我们不可能知道所有实用程序的组合 https://unocss.dev/guide/extracting#safelist
const safeVscodeIconsList = Object.keys(vscodeIcons.icons).map(
  icon => `i-${vscodeIcons.prefix}:${icon}`,
)

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
