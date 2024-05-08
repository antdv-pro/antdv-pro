import { isFunction } from '@v-c/utils'
import { defineComponent } from 'vue'

export const ParentCompConsumer = defineComponent({
  name: 'ParentCompConsumer',
  setup(_, { slots }) {
    const route = useRoute()
    const parentMap = /* @__PURE__ */ new Map()
    return () => {
      const parentName = route.meta?.parentName
      const parentComps = route.meta?.parentComps
      if (parentName) {
        if (parentMap.has(parentName)) {
          return parentMap.get(parentName)
        }
        else {
          if (parentComps?.length) {
            let comp
            for (const parentComp of [...parentComps].reverse()) {
              const comp1 = isFunction(parentComp) ? defineAsyncComponent(parentComp) : parentComp
              if (comp) {
                comp = h(comp1, null, {
                  default: () => comp,
                })
              }
              else {
                comp = h(comp1, null, slots)
              }
            }
            if (comp) {
              parentMap.set(parentName, comp)
              return comp
            }
          }
        }
      }
      return slots?.default?.()
    }
  },
})
