import type { TransportImportWorkerResponse, WorkbookSheetData } from './transport-import.worker'

let requestSequence = 0

async function runWorker<T>(file: File, type: 'workbook' | 'pdf-text'): Promise<T> {
  const buffer = await file.arrayBuffer()
  const id = ++requestSequence
  const worker = new Worker(new URL('./transport-import.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate()
      reject(new Error('文件解析超时'))
    }, 60_000)
    worker.onmessage = (event: MessageEvent<TransportImportWorkerResponse>) => {
      if (event.data.id !== id)
        return
      window.clearTimeout(timeout)
      worker.terminate()
      if (event.data.ok)
        resolve(event.data.result as T)
      else
        reject(new Error(event.data.error))
    }
    worker.onerror = (event) => {
      window.clearTimeout(timeout)
      worker.terminate()
      reject(new Error(event.message || '文件解析线程异常'))
    }
    worker.postMessage({ id, type, buffer }, [buffer])
  })
}

export function parseTransportWorkbook(file: File) {
  return runWorker<WorkbookSheetData[]>(file, 'workbook')
}

export function extractTransportPdfText(file: File) {
  return runWorker<string>(file, 'pdf-text')
}

export async function getTransportFileContentHash(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}
