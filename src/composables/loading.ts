export const useLoadingCheck = () => {
  const loading = document.querySelector('#loading-app')
  if (loading) {
    const body = document.querySelector('body')
    setTimeout(() => {
      body?.removeChild(loading)
    }, 500)
  }
}
