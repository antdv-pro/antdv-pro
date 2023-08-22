
import type { LoadingEnum } from '~#/loading-enum'
import baseLoading from '@/components/base-loading/index.vue'

interface LoadingType {
  text?: string
  textColor?: string
  background?: string
  spin?: LoadingEnum
  minTime?: number
  modal?: boolean
}
/**
 * 全局loading配置
 * @param spin loading样式
 * @param minTime loading最短时间
 * @param modal loading遮罩是否开启
 * @param background loading背景
 * @param textColor loading文字颜色
 * @param color loading文字
 */
export function useLoading(config: LoadingType = {}) {
  const loadingConstructor = createApp(baseLoading, { ...config })
  let instance: any = null
  let startTime = 0
  let endTime = 0
  const minTime = config.minTime || 0

  const open = (target: HTMLElement = document.body) => {
    if (!instance)
      instance = loadingConstructor.mount(document.createElement('div'))

    if (!instance || !instance.$el) return
    target?.appendChild?.(instance.$el)
    startTime = performance.now()
  }

  const close = () => {
    if (!instance || !instance.$el) return
    endTime = performance.now()
    if (endTime - startTime < minTime) {
      setTimeout(() => {
        instance.$el.parentNode?.removeChild(instance.$el)
      }, Math.floor(minTime - (endTime - startTime)))
    }
    else {
      instance.$el.parentNode?.removeChild(instance.$el)
    }
  }

  return {
    open,
    close,
  }
}
