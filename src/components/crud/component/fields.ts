import input from './input.vue'
import textarea from './textarea.vue'
import select from './select.vue'
import radio from './radio.vue'
import checkbox from './checkbox.vue'
import typeSwitch from './switch.vue'

export default {
  input,
  textarea,
  select,
  radio,
  checkbox,
  switch: typeSwitch,
  // date: () => import('./date.vue'),
  // time: () => import('./time.vue'),
  // rate: () => import('./rate.vue'),
  // slider: () => import('./slider.vue'),
  // upload: () => import('./upload.vue'),
} as any
