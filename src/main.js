import { createPinia } from 'pinia'
import { createApp } from 'vue'
import Root from './App.vue'
import { setupI18n } from './locales/index.js'
import {
  setupAccessDirective,
  setupLoadingDirective,
} from './directive/index.js'
import router from '~/router'
import '~/router/router-guard'
import 'ant-design-vue/dist/reset.css'
import '~/assets/styles/reset.css'
import 'uno.css'

const pinia = createPinia()
async function start() {
  const app = createApp(Root)
  app.use(pinia)
  await setupI18n(app)
  setupDirective(app)
  app.use(router)
  app.mount('#app')
  app.config.performance = true
}
function setupDirective(app) {
  setupLoadingDirective(app)
  setupAccessDirective(app)
}
start()
