const reloadKey = 'app:stale-asset-fallback-at'
const lastReloadAt = Number(sessionStorage.getItem(reloadKey) || 0)

if (Date.now() - lastReloadAt > 60_000) {
  sessionStorage.setItem(reloadKey, String(Date.now()))
  window.location.reload()
}

export default {}
