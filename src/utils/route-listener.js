import mitt from 'mitt'

const emitter = mitt()
const key = Symbol('ROUTE_CHANGE')
let latestRoute
export function setRouteEmitter(to) {
  emitter.emit(key, to)
  latestRoute = to
}
export function listenerRouteChange(handler, immediate = true) {
  emitter.on(key, handler)
  if (immediate && latestRoute)
    handler(latestRoute)
}
export function removeRouteListener() {
  emitter.off(key)
}
