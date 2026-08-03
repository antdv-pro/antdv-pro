import { beforeEach, describe, expect, it } from 'vitest'
import { runtimeConfig } from './runtime-config'
import { validateUploadFile } from './upload-security'

describe('validateUploadFile', () => {
  beforeEach(() => {
    runtimeConfig.upload.allowedExtensions = ['.xlsx', '.pdf']
    runtimeConfig.upload.maxSizeMb = 2
  })

  it('accepts allowed extensions case-insensitively at the size limit', () => {
    expect(() => validateUploadFile({ filename: 'REPORT.XLSX', size: 2 * 1024 * 1024 })).not.toThrow()
  })

  it('rejects unknown extensions, oversized files and path traversal names', () => {
    expect(() => validateUploadFile({ filename: 'payload.exe', size: 1 })).toThrow('不支持的文件类型: .exe')
    expect(() => validateUploadFile({ filename: 'report.pdf', size: 2 * 1024 * 1024 + 1 })).toThrow('文件不能超过 2MB')
    expect(() => validateUploadFile({ filename: '../report.pdf', size: 1 })).toThrow('文件名不合法')
  })
})
