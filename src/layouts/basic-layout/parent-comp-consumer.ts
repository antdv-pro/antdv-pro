import { isFunction } from '@v-c/utils'
import { defineComponent } from 'vue'

export const ParentCompConsumer = defineComponent({
  name: 'ParentCompConsumer',
  setup(_, { slots }) {
    const route = useRoute()
    return () => {
      const components = route.meta?.parentComponents
      if (components) {
        let component
        for (const component1 of [...components].reverse()) {
          const getComp = isFunction(component1) ? defineAsyncComponent(component1 as any) : component1
          if (component)
            component = h(getComp!, null, { default: () => component! })
          else
            component = h(getComp!, null, slots)
        }
        if (component)
          return component
      }
      return slots?.default?.()
    }
  },
})
