<script setup>
defineProps({
  access: { type: [String, Number, Array], required: true },
})
const { hasAccess } = useAccess()
</script>

<template>
  <slot v-if="hasAccess(access)" />
</template>
