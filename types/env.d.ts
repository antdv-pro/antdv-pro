/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_APP_BASE: string
  readonly VITE_APP_BASE_API: string
  readonly VITE_APP_BASE_API_DEV: string
  readonly VITE_APP_BASE_URL: string
  readonly VITE_APP_BASE_URL_DEV: string
  readonly VITE_APP_LOAD_ROUTE_WAY: 'FRONTEND' | 'BACKEND'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
