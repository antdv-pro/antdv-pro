
export interface LocaleState {
  locale: string
}

const LOCALE_KEY = 'locale'

export const lsLocaleState = useStorage(LOCALE_KEY, 'zh-CN')

export const useLocaleStore = defineStore({
  id: 'app-locale',
  state: (): LocaleState => ({
    locale: lsLocaleState.value,
  }),
  getters: {
    getLocale(state): string {
      return state.locale ?? 'zh-CN'
    },
  },
  actions: {
    setLocaleInfo(info: string) {
      lsLocaleState.value = info
    },
  },
})
