import type { useAppStore } from '~/stores/app.ts'

export const LayoutMenuKey = Symbol('LayoutMenu')
export function useLayoutMenuProvide(layoutMenu: ReturnType<typeof useLayoutMenu>, appStore: ReturnType<typeof useAppStore>) {
  provide(LayoutMenuKey, { layoutMenu, appStore })
}

export function useLayoutMenuInject() {
  return inject(LayoutMenuKey, {} as any)
}
