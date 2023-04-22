import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'
import AntdvResolver from './plugins/antdv'
const baseSrc = fileURLToPath(new URL('./src', import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'vue-i18n',
        '@vueuse/core',
        'pinia',
      ],
      dts: 'types/auto-imports.d.ts',
      dirs: ['src/stores', 'src/composables'],
    }),
    Components({
      resolvers: [AntdvResolver()],
      dts: 'types/components.d.ts',
      dirs: ['src/components'],
    }),
    Unocss(),
  ],
  resolve: {
    alias: {
      '~@': baseSrc,
      '~': baseSrc,
      '@': baseSrc,
    },
  },
  server: {
    port: 6678,
  },
})
