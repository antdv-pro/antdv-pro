<script setup>
const route = useRoute()
const router = useRouter()
const params = route.params
const path = params?.path ? decodeURIComponent(params.path) : ''
if (path)
  router.replace(path)
else
  router.replace('/')
</script>

<template>
  <div>
    <h1>Redirecting...</h1>
  </div>
</template>
