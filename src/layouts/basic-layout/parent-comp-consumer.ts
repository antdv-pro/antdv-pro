import { isFunction } from '@v-c/utils'
import { defineComponent } from 'vue'

export const ParentCompConsumer = defineComponent({
  name: 'ParentCompConsumer',
  setup(_, { slots }) {
    const route = useRoute()
    const parentMap = new Map<string, any>()
    return () => {
      const parentName = route.meta?.parentName
      const parentComps = route.meta?.parentComps

      if (parentName) {
        // 获取组件的信息
        if (parentMap.has(parentName)) {
          return parentMap.get(parentName)
        }
        else {
          // 不存在判断是否存在parentComps
          if (parentComps?.length) {
            // 获取组件的信息
            let comp: any
            for (const parentComp of [...parentComps].reverse()) {
              // 有内到外
              const comp1: any = isFunction(parentComp) ? defineAsyncComponent(parentComp as any) : parentComp
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
