import { useLoading } from '@/composables/base-loading'
import BaseLoading from '@/components/base-loading/index.vue'

const loadingDirective = {
  mounted(el, bind) {
    const { props } = BaseLoading
    const full = el.getAttribute('loading-full')
    const text = el.getAttribute('loading-text') || props.text.default
    const textColor = el.getAttribute('loading-text-color') || props.textColor.default
    const background = el.getAttribute('loading-background') || props.background.default
    const spin = el.getAttribute('loading-spin') || props.spin.default
    const instance = useLoading({
      text,
      textColor,
      background,
      spin,
    })
    el.instance = instance
    if (bind.value)
      instance.open(full ? document.body : el)
  },
  updated(el, bind) {
    const instance = el.instance
    if (!instance)
      return
    if (bind.value) {
      instance.open(
        el.getAttribute('loading-full') === 'true' ? document.body : el,
      )
    }
    else {
      instance.close()
    }
  },
  unmounted(el) {
    el?.instance?.close()
  },
}
export function setupLoadingDirective(app) {
  app.directive('loading', loadingDirective)
}
export default loadingDirective
