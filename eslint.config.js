import mist from '@antfu/eslint-config'

export default mist({
  vue: true,
  vueJsx: false,
  typescript: true,
  gitignore: true,
  markdown: true,
  ignores: [
    'types/auto-imports.d.ts',
    'types/components.d.ts',
    'public',
    'tsconfig.*.json',
    'tsconfig.json',
  ],
}, {
  rules: {
    'no-console': 0,
    'style/quote-props': 0,
    'unused-imports/no-unused-vars': 0,
    'ts/no-unused-expressions': 0,
  },
})
