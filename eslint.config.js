import mist from '@mistjs/eslint-config'

export default mist({
  vue: true,
  vueJsx: false,
  typescript: true,
  gitignore: true,
  markdown: true,
  ignores: [
    'tsconfig.*.json',
    'tsconfig.json',
  ],
}, {
  rules: {
    'no-console': 'off',
  },
})
