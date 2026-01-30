<script setup lang="ts">
import { ConfigProvider } from 'antdv-next'
import { useLayoutMenuProvide } from '~/components/page-container/context'

const appStore = useAppStore()
const { theme } = storeToRefs(appStore)
const { antd } = useI18nLocale()
const layoutMenu = useLayoutMenu()
useLayoutMenuProvide(layoutMenu, appStore)
const instance = getCurrentInstance()
watchEffect(() => {
  ConfigProvider.config({
    theme: theme.value,
    appContext: instance?.appContext,
  })
})
</script>

<template>
  <a-config-provider :theme="theme" :locale="antd">
    <a-app class="h-full font-chinese antialiased">
      <TokenProvider>
        <RouterView />
      </TokenProvider>
    </a-app>
  </a-config-provider>
</template>
