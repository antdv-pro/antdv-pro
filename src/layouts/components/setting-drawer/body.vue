<script setup>
defineProps({
  title: { type: String, required: false },
})
</script>

<template>
  <div mb-24px>
    <h3 font-500 mb-12px text-14px line-height-22px>
      {{ title }}
    </h3>
    <slot />
  </div>
</template>
