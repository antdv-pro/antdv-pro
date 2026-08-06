import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { ContentTypeEnum, RequestEnum } from '~#/http-enum'
import { STORAGE_AUTHORIZE_KEY, useAuthorization } from '~/composables/authorization'
import router from '~/router'
import { AxiosLoading } from './loading'

export interface ResponseBody<T = any> {
  code: number
  data?: T
  msg: string
}

export interface RequestConfigExtra {
  token?: boolean
  customDev?: boolean
  loading?: boolean
  errorNotification?: boolean
}
const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API ?? '/',
  timeout: 15000,
  headers: { 'Content-Type': ContentTypeEnum.JSON },
})
const axiosLoading = new AxiosLoading()
async function requestHandler(config: InternalAxiosRequestConfig & RequestConfigExtra): Promise<InternalAxiosRequestConfig> {
  // 处理请求前的url
  if (
    import.meta.env.DEV
      && import.meta.env.VITE_APP_BASE_API_DEV
      && import.meta.env.VITE_APP_BASE_URL_DEV
      && config.customDev
  ) {
    //  替换url的请求前缀baseUrl
    config.baseURL = import.meta.env.VITE_APP_BASE_API_DEV
  }
  const token = useAuthorization()

  if (token.value && config.token !== false)
    config.headers.set(STORAGE_AUTHORIZE_KEY, token.value)

  // 增加多语言的配置
  const { locale } = useI18nLocale()
  config.headers.set('Accept-Language', locale.value ?? 'zh-CN')
  if (config.loading)
    axiosLoading.addLoading()
  return config
}

function responseHandler(response: any): ResponseBody<any> | AxiosResponse<any> | Promise<any> | any {
  return response.data
}

function errorHandler(error: AxiosError): Promise<any> {
  const token = useAuthorization()
  const notification = useNotification()
  const showErrorNotification = (error.config as RequestConfigExtra | undefined)?.errorNotification !== false

  if (error.code === 'ECONNABORTED' && showErrorNotification) {
    notification?.error({
      message: '服务响应超时',
      description: '服务器暂时无法响应，请稍后重试。',
      duration: 5,
    })
  }
  else if (!error.response && showErrorNotification) {
    notification?.error({
      message: '无法连接服务器',
      description: '请检查网络连接，或稍后重试。',
      duration: 5,
    })
  }
  else if (error.response) {
    const { data, status, statusText } = error.response as AxiosResponse<ResponseBody>
    if (status === 401) {
      if (showErrorNotification) {
        notification?.error({
          message: '401',
          description: data?.msg || statusText,
          duration: 3,
        })
      }
      /**
       * 这里处理清空用户信息和token的逻辑，后续扩展
       */
      token.value = null

      const { fullPath, query: { redirect } } = router.currentRoute.value
      router
        .push({
          path: '/login',
          query: {
            redirect: redirect || fullPath,
          },
        })
        .then(() => {})
    }
    else if (status === 403 && showErrorNotification) {
      notification?.error({
        message: '403',
        description: data?.msg || statusText,
        duration: 3,
      })
    }
    else if (status === 500 && showErrorNotification) {
      notification?.error({
        message: '500',
        description: data?.msg || statusText,
        duration: 3,
      })
    }
    else if (showErrorNotification) {
      notification?.error({
        message: '服务错误',
        description: data?.msg || statusText,
        duration: 3,
      })
    }
  }
  return Promise.reject(error)
}
interface AxiosOptions<T> {
  url: string
  params?: T
  data?: T
}
instance.interceptors.request.use(requestHandler)

instance.interceptors.response.use(responseHandler, errorHandler)

export default instance
function instancePromise<R = any, T = any>(options: AxiosOptions<T> & RequestConfigExtra): Promise<ResponseBody<R>> {
  const { loading } = options
  return new Promise((resolve, reject) => {
    instance.request(options).then((res) => {
      resolve(res as any)
    }).catch((e: Error | AxiosError) => {
      reject(e)
    }).finally(() => {
      if (loading)
        axiosLoading.closeLoading()
    })
  })
}
export function useGet<R = any, T = any>(url: string, params?: T, config?: AxiosRequestConfig & RequestConfigExtra): Promise<ResponseBody<R>> {
  const options = {
    ...config,
    url,
    params,
    method: RequestEnum.GET,
  }
  return instancePromise<R, T>(options)
}

export function usePost<R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig & RequestConfigExtra): Promise<ResponseBody<R>> {
  const options = {
    ...config,
    url,
    data,
    method: RequestEnum.POST,
  }
  return instancePromise<R, T>(options)
}

export function usePut<R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig & RequestConfigExtra): Promise<ResponseBody<R>> {
  const options = {
    ...config,
    url,
    data,
    method: RequestEnum.PUT,
  }
  return instancePromise<R, T>(options)
}

export function useDelete<R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig & RequestConfigExtra): Promise<ResponseBody<R>> {
  const options = {
    ...config,
    url,
    data,
    method: RequestEnum.DELETE,
  }
  return instancePromise<R, T>(options)
}
