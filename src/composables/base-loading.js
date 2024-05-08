import baseLoading from '@/components/base-loading/index.vue'

export function useLoading(config = {}) {
  const loadingConstructor = createApp(baseLoading, { ...config })
  let instance = null
  let startTime = 0
  let endTime = 0
  const minTime = config.minTime || 0
  const open = (target = document.body) => {
    if (!instance)
      instance = loadingConstructor.mount(document.createElement('div'))
    if (!instance || !instance.$el)
      return
    target?.appendChild?.(instance.$el)
    startTime = performance.now()
  }
  const close = () => {
    if (!instance || !instance.$el)
      return
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
