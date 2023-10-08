<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const params = route.params
const path = params?.path ? decodeURIComponent(params.path as string) : ''
if (path)
  router.replace(path)
else router.replace('/')
</script>

<template>
  <div>
    <h1>Redirecting...</h1>
  </div>
</template>
