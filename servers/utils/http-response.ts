import type { H3Event } from 'h3'
import { createError, setResponseStatus } from 'h3'

export interface ApiResponse<T> {
  code: number
  msg: string
  data?: T
}

export class DomainError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'DomainError'
    this.statusCode = statusCode
  }
}

export function ok<T>(data: T, msg = '操作成功'): ApiResponse<T> {
  return { code: 200, msg, data }
}

export function fail(event: H3Event, error: unknown, fallback = '操作失败'): ApiResponse<never> {
  const statusCode = error instanceof DomainError ? error.statusCode : 500
  const message = error instanceof DomainError ? error.message : fallback
  setResponseStatus(event, statusCode)
  return { code: statusCode, msg: message }
}

export function badRequest(message: string): never {
  throw new DomainError(message, 400)
}

export function asBadRequest(error: unknown, fallback = '请求参数无效') {
  return error instanceof DomainError
    ? error
    : new DomainError(error instanceof Error ? error.message : fallback, 400)
}

export function toHttpError(error: unknown, fallback = '服务暂不可用') {
  if (error instanceof DomainError)
    return createError({ statusCode: error.statusCode, statusMessage: error.message })
  return createError({ statusCode: 500, statusMessage: fallback, cause: error })
}
