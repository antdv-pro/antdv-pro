import { get } from 'lodash-es'
import router from '@/router'

export function getQueryParam(param: string | string[], defaultVal = '') {
  const query = router.currentRoute.value?.query ?? {}
  const val = get(query, param) ?? defaultVal
  const rawValue = Array.isArray(val) ? val[0] : val
  if (typeof rawValue !== 'string')
    return String(rawValue)
  try {
    return decodeURIComponent(rawValue)
  }
  catch {
    return rawValue
  }
}
