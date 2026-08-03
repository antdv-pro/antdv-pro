import { extname } from 'node:path'
import { runtimeConfig } from './runtime-config'

export interface UploadCandidate {
  filename: string
  size: number
  contentType?: string
}

export function validateUploadFile(file: UploadCandidate) {
  const ext = extname(file.filename).toLowerCase()
  const maxBytes = runtimeConfig.upload.maxSizeMb * 1024 * 1024

  if (!runtimeConfig.upload.allowedExtensions.includes(ext))
    throw new Error(`不支持的文件类型: ${ext || 'unknown'}`)

  if (file.size > maxBytes)
    throw new Error(`文件不能超过 ${runtimeConfig.upload.maxSizeMb}MB`)

  if (/[\\/]/.test(file.filename))
    throw new Error('文件名不合法')
}
