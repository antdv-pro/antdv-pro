<script setup lang="ts">
const router = useRouter()
const back = () => {
  router.replace({
    path: '/',
  })
}
</script>

<template>
  <a-result status="403" title="403" sub-title="Sorry, you don't have access to this page.">
    <template #extra>
      <a-button type="primary" @click="back">
        Back to home
      </a-button>
    </template>
  </a-result>
</template>
