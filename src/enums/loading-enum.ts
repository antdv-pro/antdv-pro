import pulseSpin from '@/components/base-loading/spin/pulse-spin.vue'
import rectSpin from '@/components/base-loading/spin/rect-spin.vue'
import planeSpin from '@/components/base-loading/spin/plane-spin.vue'
import cubeSpin from '@/components/base-loading/spin/cube-spin.vue'
import preloaderSpin from '@/components/base-loading/spin/preloader-spin.vue'
import chaseSpin from '@/components/base-loading/spin/chase-spin.vue'
import dotSpin from '@/components/base-loading/spin/dot-spin.vue'

export enum LoadingEnum {
  PULSE = 'pulse',
  RECT = 'rect',
  PLANE = 'plane',
  CUBE = 'cube',
  PRELOADER = 'preloader',
  CHASE = 'chase',
  DOT = 'dot',
}

const loadingMap = new Map<LoadingEnum, Component>()

loadingMap.set(LoadingEnum.PULSE, pulseSpin)
loadingMap.set(LoadingEnum.RECT, rectSpin)
loadingMap.set(LoadingEnum.PLANE, planeSpin)
loadingMap.set(LoadingEnum.CUBE, cubeSpin)
loadingMap.set(LoadingEnum.PRELOADER, preloaderSpin)
loadingMap.set(LoadingEnum.CHASE, chaseSpin)
loadingMap.set(LoadingEnum.DOT, dotSpin)

export { loadingMap }
