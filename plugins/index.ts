import type { PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import GenerateConfig from 'unplugin-config/vite'
import Components from 'unplugin-vue-components/vite'
import VitePluginPreloadAll from '@mistjs/vite-plugin-preload'
import Unocss from 'unocss/vite'
import AntdvResolver from 'antdv-component-resolver'
import { GLOB_CONFIG_FILE_NAME, OUTPUT_DIR } from './constants'
import { viteBuildInfo } from './vite-build-info'

export function createVitePlugins(env: Record<string, string>) {
  const vitePluginList: (PluginOption | PluginOption[])[] = [
    vue(),
    vueJsx(),
    VitePluginPreloadAll(),
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
    // https://github.com/kirklin/unplugin-config
    GenerateConfig({
      appName: env.VITE_GLOB_APP_TITLE,
      configFile: {
        generate: true,
        fileName: GLOB_CONFIG_FILE_NAME,
        outputDir: OUTPUT_DIR,
      },
      envVariables: {
        prefix: 'VITE_GLOB_',
      },
    }),
    Unocss(),
    viteBuildInfo(env.VITE_APP_NAME),
  ]
  return vitePluginList
}
