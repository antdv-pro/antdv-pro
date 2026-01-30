<script setup lang="ts">
import type { MenuItemType } from 'antdv-next'
import { LogoutOutlined, ProfileOutlined, UserOutlined } from '@antdv-next/icons'

import { h } from 'vue'

const message = useMessage()
const userStore = useUserStore()
const multiTabStore = useMultiTab()
const layoutMenuStore = useLayoutMenu()
const router = useRouter()
const { avatar, nickname } = storeToRefs(userStore)

const menuItems: MenuItemType[] = [
  {
    key: 'center',
    label: '个人中心',
    icon: h(UserOutlined),
  },
  {
    key: 'settings',
    label: '个人设置',
    icon: h(ProfileOutlined),
  },
  { type: 'divider' },
  {
    key: 'logout',
    label: '退出登录',
    icon: h(LogoutOutlined),
  },
]
async function handleClick({ key }: any) {
  if (key === 'center') {
    await router.push({ path: '/account/center' })
    return
  }
  if (key === 'settings') {
    await router.push({ path: '/account/settings' })
    return
  }
  if (key === 'logout') {
    const hide = message.loading('退出登录...', 0)
    try {
      await userStore.logout()
    }
    finally {
      hide()
      message.success('退出登录成功', 3)
      router.push({
        path: '/login',
      }).then(() => {
        multiTabStore.clear()
        layoutMenuStore.clear()
      })
    }
  }
}
</script>

<template>
  <a-dropdown>
    <span hover="bg-[var(--hover-color)]" flex items-center h-48px px-12px cursor-pointer class="transition-all-300">
      <a-avatar :src="avatar" mr-8px size="small" />
      <span class="anticon">{{ nickname }}</span>
    </span>
    <template #popupRender>
      <a-menu :items="menuItems" @click="handleClick" />
    </template>
  </a-dropdown>
</template>
