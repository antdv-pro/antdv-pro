import { createRouter, createWebHistory } from 'vue-router'
import staticRoutes from './static-routes'

const router = createRouter({
  routes: [
    ...staticRoutes,
  ],
  history: createWebHistory(import.meta.env.VITE_APP_BASE),
})

const staleAssetReloadKey = 'app:stale-asset-reload-at'
const staleAssetErrorPattern = /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

function reloadWithLatestAssets() {
  const lastReloadAt = Number(sessionStorage.getItem(staleAssetReloadKey) || 0)
  if (Date.now() - lastReloadAt < 60_000)
    return
  sessionStorage.setItem(staleAssetReloadKey, String(Date.now()))
  window.location.reload()
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadWithLatestAssets()
})

router.onError((error) => {
  if (staleAssetErrorPattern.test(String(error?.message || error)))
    reloadWithLatestAssets()
})

export default router
