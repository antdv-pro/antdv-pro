import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ProLayout',
  setup(_, { slots }) {
    return () => slots.default?.()
  },
})
