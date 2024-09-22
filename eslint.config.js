import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-console': 0,
    'style/quote-props': 0,
    'no-undef': 0,
    'unused-imports/no-unused-vars': 0,
  },
  ignores: [
    'types/auto-imports.d.ts',
    'types/components.d.ts',
    'public',
    'tsconfig.*.json',
    'tsconfig.json',
  ],
})
