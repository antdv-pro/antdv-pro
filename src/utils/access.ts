import type { Directive } from 'vue'

export const accessDirective: Directive = (el, binding) => {
  const { hasAccess } = useAccess()
  if (!hasAccess(binding.value))
    el.parentNode?.removeChild(el)
}
