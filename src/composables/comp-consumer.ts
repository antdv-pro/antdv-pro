import type { VNode } from 'vue'
import { createVNode } from 'vue'

const compMap = new Map<string, VNode>()

export function useCompConsumer() {
  const route = useRoute()
  const getComp = (component: VNode): VNode => {
    // 判断当前是否包含name，如果不包含name，那就直接处理掉name
    if (!route.name)
      return component

    // 获取当前组件的name
    // @ts-expect-error this is obj
    const compName = component?.type?.name
    const routeName = route.name as string
    if (compMap.has(routeName))
      return compMap.get(routeName) as VNode

    // 不存在的情况下，就需要进行组织
    const node = component
    if (compName && compName === routeName) {
      compMap.set(routeName, node)
      return node
    }

    const Comp = createVNode(node)
    if (!Comp.type)
      Comp.type = {}

    // @ts-expect-error this is obj
    Comp.type.name = routeName
    compMap.set(routeName, Comp)
    return Comp
  }

  return {
    getComp,
  }
}
