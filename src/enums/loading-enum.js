import pulseSpin from '@/components/base-loading/spin/pulse-spin.vue'
import rectSpin from '@/components/base-loading/spin/rect-spin.vue'
import planeSpin from '@/components/base-loading/spin/plane-spin.vue'
import cubeSpin from '@/components/base-loading/spin/cube-spin.vue'
import preloaderSpin from '@/components/base-loading/spin/preloader-spin.vue'
import chaseSpin from '@/components/base-loading/spin/chase-spin.vue'
import dotSpin from '@/components/base-loading/spin/dot-spin.vue'

export const LoadingEnum = /* @__PURE__ */ ((LoadingEnum2) => {
  LoadingEnum2.PULSE = 'pulse'
  LoadingEnum2.RECT = 'rect'
  LoadingEnum2.PLANE = 'plane'
  LoadingEnum2.CUBE = 'cube'
  LoadingEnum2.PRELOADER = 'preloader'
  LoadingEnum2.CHASE = 'chase'
  LoadingEnum2.DOT = 'dot'
  return LoadingEnum2
})({})
const loadingMap = /* @__PURE__ */ new Map()
loadingMap.set('pulse' /* PULSE */, pulseSpin)
loadingMap.set('rect' /* RECT */, rectSpin)
loadingMap.set('plane' /* PLANE */, planeSpin)
loadingMap.set('cube' /* CUBE */, cubeSpin)
loadingMap.set('preloader' /* PRELOADER */, preloaderSpin)
loadingMap.set('chase' /* CHASE */, chaseSpin)
loadingMap.set('dot' /* DOT */, dotSpin)
export { loadingMap }
