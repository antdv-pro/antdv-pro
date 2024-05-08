export const LayoutMenuKey = Symbol('LayoutMenu')
export function useLayoutMenuProvide(layoutMenu, appStore) {
  provide(LayoutMenuKey, { layoutMenu, appStore })
}
export function useLayoutMenuInject() {
  return inject(LayoutMenuKey, {})
}
