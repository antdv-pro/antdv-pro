import type { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { notification } from 'ant-design-vue/es'
import { STORAGE_AUTHORIZE_KEY, useAuthorization } from '~/composables/authorization'
import router from '~/router'

export interface ResponseBody<T = any> {
  code: number
  data?: T
  msg: string
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API ?? '/',
  timeout: 60000,
})

const requestHandler = async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
  const token = useAuthorization()
  if (token.value)
    config.headers.set(STORAGE_AUTHORIZE_KEY, token.value)

  return config
}

const responseHandler = (response: any): ResponseBody<any> | AxiosResponse<any> | Promise<any> | any => {
  return response.data
}

const errorHandler = (error: AxiosError): Promise<any> => {
  // const { notification } = useGlobalConfig()
  const token = useAuthorization()

  if (error.response) {
    const { data, status, statusText } = error.response as AxiosResponse<ResponseBody>
    if (status === 401) {
      notification?.error({
        message: '401',
        description: data?.msg || statusText,
        duration: 3000,
      })
      /**
       * 这里处理清空用户信息和token的逻辑，后续扩展
       */
      token.value = null
      router
        .replace({
          path: '/login',
          query: {
            redirect: router.currentRoute.value.path,
          },
        })
        .then(() => {})
    }
    else if (status === 403) {
      // notification?.error({
      //   title: i18n.global.t('global.request.error.403'),
      //   content: data?.msg || statusText,
      //   duration: 3000
      // })
    }
    else if (status === 500) {
      // notification?.error({
      //   title: i18n.global.t('global.request.error.500'),
      //   content: data?.msg || statusText,
      //   duration: 3000
      // })
    }
    else {
      // notification?.error({
      //   title: i18n.global.t('global.request.error.other'),
      //   content: data?.msg || statusText,
      //   duration: 3000
      // })
    }
  }
  return Promise.reject(error)
}

instance.interceptors.request.use(requestHandler)

instance.interceptors.response.use(responseHandler, errorHandler)

export default instance

export const useGet = <R = any, T = any>(url: string, params?: T, config?: AxiosRequestConfig): Promise<ResponseBody<R>> => {
  return instance.request({
    url,
    params,
    method: 'GET',
    ...config,
  })
}

export const usePost = < R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig): Promise<ResponseBody<R>> => {
  return instance.request({
    url,
    data,
    method: 'POST',
    ...config,
  })
}

export const usePut = < R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig): Promise<ResponseBody<R>> => {
  return instance.request({
    url,
    data,
    method: 'PUT',
    ...config,
  })
}

export const useDelete = < R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig): Promise<ResponseBody<R>> => {
  return instance.request({
    url,
    data,
    method: 'DELETE',
    ...config,
  })
}
