<script setup>
const router = useRouter()
function back() {
  router.replace({
    path: '/',
  })
}
</script>

<template>
  <a-result status="500" title="500" sub-title="Sorry, the server is reporting an error.">
    <template #extra>
      <a-button type="primary" @click="back">
        Back Home
      </a-button>
    </template>
  </a-result>
</template>
