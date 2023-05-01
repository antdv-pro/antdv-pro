export const useMultiTab = defineStore('multi-tab', () => {
  const state = reactive({
    list: [],
  })
  return {
    state,
  }
})
