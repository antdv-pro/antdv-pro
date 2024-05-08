import axios from 'axios'
import { AxiosLoading } from './loading.js'
import { STORAGE_AUTHORIZE_KEY, useAuthorization } from '~/composables/authorization'
import { ContentTypeEnum, RequestEnum } from '~#/http-enum'
import router from '~/router'

const instance = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API ?? '/',
  timeout: 6e4,
  headers: { 'Content-Type': ContentTypeEnum.JSON },
})
const axiosLoading = new AxiosLoading()
async function requestHandler(config) {
  if (import.meta.env.DEV && import.meta.env.VITE_APP_BASE_API_DEV && import.meta.env.VITE_APP_BASE_URL_DEV && config.customDev)
    config.baseURL = import.meta.env.VITE_APP_BASE_API_DEV

  const token = useAuthorization()
  if (token.value && config.token !== false)
    config.headers.set(STORAGE_AUTHORIZE_KEY, token.value)
  const { locale } = useI18nLocale()
  config.headers.set('Accept-Language', locale.value ?? 'zh-CN')
  if (config.loading)
    axiosLoading.addLoading()
  return config
}
function responseHandler(response) {
  return response.data
}
function errorHandler(error) {
  const token = useAuthorization()
  const notification = useNotification()
  if (error.response) {
    const { data, status, statusText } = error.response
    if (status === 401) {
      notification?.error({
        message: '401',
        description: data?.msg || statusText,
        duration: 3,
      })
      token.value = null
      router.push({
        path: '/login',
        query: {
          redirect: router.currentRoute.value.fullPath,
        },
      }).then(() => {
      })
    }
    else if (status === 403) {
      notification?.error({
        message: '403',
        description: data?.msg || statusText,
        duration: 3,
      })
    }
    else if (status === 500) {
      notification?.error({
        message: '500',
        description: data?.msg || statusText,
        duration: 3,
      })
    }
    else {
      notification?.error({
        message: '服务错误',
        description: data?.msg || statusText,
        duration: 3,
      })
    }
  }
  return Promise.reject(error)
}
instance.interceptors.request.use(requestHandler)
instance.interceptors.response.use(responseHandler, errorHandler)
export default instance
function instancePromise(options) {
  const { loading } = options
  return new Promise((resolve, reject) => {
    instance.request(options).then((res) => {
      resolve(res)
    }).catch((e) => {
      reject(e)
    }).finally(() => {
      if (loading)
        axiosLoading.closeLoading()
    })
  })
}
export function useGet(url, params, config) {
  const options = {
    url,
    params,
    method: RequestEnum.GET,
    ...config,
  }
  return instancePromise(options)
}
export function usePost(url, data, config) {
  const options = {
    url,
    data,
    method: RequestEnum.POST,
    ...config,
  }
  return instancePromise(options)
}
export function usePut(url, data, config) {
  const options = {
    url,
    data,
    method: RequestEnum.PUT,
    ...config,
  }
  return instancePromise(options)
}
export function useDelete(url, data, config) {
  const options = {
    url,
    data,
    method: RequestEnum.DELETE,
    ...config,
  }
  return instancePromise(options)
}
