/**
 * 单独监听路由会浪费渲染性能。使用发布订阅模式去进行分发管理。
 */
import type { Handler } from 'mitt'
import type { RouteLocationNormalized } from 'vue-router'
import mitt from 'mitt'

const emitter = mitt()

const key = Symbol('ROUTE_CHANGE')

let latestRoute: RouteLocationNormalized

export function setRouteEmitter(to: RouteLocationNormalized) {
  emitter.emit(key, to)
  latestRoute = to
}

export function listenerRouteChange(
  handler: (route: RouteLocationNormalized) => void,
  immediate = true,
) {
  emitter.on(key, handler as Handler)
  if (immediate && latestRoute)
    handler(latestRoute)
}

export function removeRouteListener() {
  emitter.off(key)
}
