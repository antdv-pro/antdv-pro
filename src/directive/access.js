export function accessDirective(el, binding) {
  const { hasAccess } = useAccess()
  if (!hasAccess(binding.value))
    el.parentNode?.removeChild(el)
}
export function setupAccessDirective(app) {
  app.directive('access', accessDirective)
}
