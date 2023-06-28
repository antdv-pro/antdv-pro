export const useLoadingCheck = () => {
  const loading = document.querySelector('body > #loading-app')
  if (loading) {
    const body = document.querySelector('body')
    setTimeout(() => {
      body?.removeChild(loading)
    }, 100)
  }
}
