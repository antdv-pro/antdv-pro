<script setup lang="ts">
import { MenuFoldOutlined, MenuUnfoldOutlined, UploadOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons-vue'
import type { CSSProperties } from 'vue'
import { useLayoutState } from '../../basic-layout/context'
const { collapsed, handleCollapsed, layout, logo, title, collapsedWidth, siderWidth, headerHeight, fixedSider } = useLayoutState()

const prefixCls = shallowRef('ant-pro-sider')

const siderStyle = computed<CSSProperties>(() => {
  return {
    paddingTop: `${layout.value !== 'side' ? headerHeight.value : 0}px`,
    transition: 'background-color 0.3s ease 0s, min-width 0.3s ease 0s, max-width 0.3s cubic-bezier(0.645, 0.045, 0.355, 1) 0s',
    overflow: 'hidden',
  }
})

const cls = computed(() => ({
  [prefixCls.value]: true,
  [`${prefixCls.value}-fixed`]: fixedSider.value,
  [`${prefixCls.value}-layout-${layout.value}`]: !!layout.value,
}))

const selectedKeys = ref<string[]>([])
</script>

<template>
  <div
    v-if="fixedSider" :style="{
      width: collapsed ? `${collapsedWidth}px` : `${siderWidth}px`,
      maxWidth: collapsed ? `${collapsedWidth}px` : `${siderWidth}px`,
      minWidth: collapsed ? `${collapsedWidth}px` : `${siderWidth}px`,
      ...siderStyle,
    }"
  />
  <a-layout-sider
    theme="light"
    :collapsed="collapsed"
    :trigger="null"
    :collapsed-width="collapsedWidth"
    :width="siderWidth"
    collapsible
    :class="cls"
    :style="siderStyle"
  >
    <div v-if="layout === 'side'" class="ant-pro-sider-logo" :class="collapsed ? 'ant-pro-sider-collapsed' : ''">
      <a>
        <img :src="logo">
        <h1 v-if="!collapsed">{{ title }}</h1>
      </a>
    </div>
    <div class="flex-1 of-x-hidden of-y-auto">
      <a-menu
        v-model:selectedKeys="selectedKeys"
        mode="inline"
        :collapsed="collapsed"
        class="ant-pro-sider-menu"
      >
        <a-menu-item key="1">
          <UserOutlined />
          <span>nav 1</span>
        </a-menu-item>
        <a-menu-item key="2">
          <VideoCameraOutlined />
          <span>nav 2</span>
        </a-menu-item>
        <a-menu-item key="3">
          <UploadOutlined />
          <span>nav 3</span>
        </a-menu-item>
      </a-menu>
    </div>
    <div class="w-100% flex-shrink-0 ant-pro-sider-collapsed-button">
      <a-menu
        class="ant-pro-sider-menu"
        mode="inline"
        :selectable="false"
        @click="handleCollapsed?.(!collapsed)"
      >
        <a-menu-item>
          <template #icon>
            <MenuFoldOutlined v-if="collapsed" />
            <MenuUnfoldOutlined v-else />
          </template>
        </a-menu-item>
      </a-menu>
    </div>
  </a-layout-sider>
</template>

<style lang="less">
@import "./index.less";
</style>
