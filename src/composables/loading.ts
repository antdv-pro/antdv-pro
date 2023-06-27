export const useLoadingCheck = () => {
  onMounted(() => {
    const body = document.querySelector('body')
    const loading = document.querySelector('#loading-app')
    if (loading) {
      setTimeout(() => {
        body?.removeChild(loading)
      }, 500)
    }
  })
}
