import { defineComponent } from 'vue'

export const ParentCompConsumer = defineComponent({
  name: 'ParentCompConsumer',
  setup(_, { slots }) {
    const route = useRoute()
    console.log(route)
    return () => {
      return slots?.default?.()
    }
  },
})
