<script setup lang="ts">
import { GithubOutlined } from '@ant-design/icons-vue'

defineOptions({
  name: 'FooterLinks',
})
</script>

<template>
  <a decoration-none href="https://antdv-pro.com" target="_blank">Antdv Pro</a>
  <a decoration-none href="https://github.com/antdv-pro/antdv-admin-pro" target="_blank">
    <GithubOutlined />
  </a>
  <a decoration-none href="https://antdv.com" target="_blank">Ant Design Vue</a>
</template>
