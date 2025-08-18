import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import presetChinese from 'unocss-preset-chinese'
import presetEase from 'unocss-preset-ease'
import antdUnoTheme from './themes/antd-uno-theme.json'

export default defineConfig({
  safelist: [
    'py-16px',
    'pb-16px',
  ],
  theme: {
    ...antdUnoTheme,
  },
  presets: [
    presetWind3(),
    presetAttributify(),
    presetChinese(),
    presetEase(),
    presetTypography(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
  shortcuts: [
    ['flex-center', 'flex items-center justify-center'],
    ['flex-between', 'flex items-center justify-between'],
    ['flex-end', 'flex items-end justify-between'],
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
})
