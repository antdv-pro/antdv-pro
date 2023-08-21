import type { App, Directive } from 'vue'

export const accessDirective: Directive = (el, binding) => {
  const { hasAccess } = useAccess()
  if (!hasAccess(binding.value))
    el.parentNode?.removeChild(el)
}
export const setupAccessDirective = (app: App) => {
  app.directive('access', accessDirective)
}
