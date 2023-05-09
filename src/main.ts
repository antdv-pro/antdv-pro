import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import i18n from './locales'
import router from '~/router'
import '~/router/router-guard'
import 'ant-design-vue/dist/reset.css'
import '~/assets/styles/reset.css'
import 'uno.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(i18n)
app.mount('#app')
