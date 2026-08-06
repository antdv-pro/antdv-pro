import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import * as XLSX from 'xlsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.mjs`

export interface WorkbookSheetData {
  name: string
  matrix: unknown[][]
  rows: Array<Record<string, unknown>>
}

export type TransportImportWorkerRequest
  = | { id: number, type: 'workbook', buffer: ArrayBuffer }
    | { id: number, type: 'pdf-text', buffer: ArrayBuffer }

export type TransportImportWorkerResponse
  = | { id: number, ok: true, result: WorkbookSheetData[] | string }
    | { id: number, ok: false, error: string }

function parseWorkbook(buffer: ArrayBuffer): WorkbookSheetData[] {
  const workbook = XLSX.read(buffer, { cellDates: true })
  return workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name]
    return {
      name,
      matrix: worksheet ? XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', raw: false, blankrows: false }) : [],
      rows: worksheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: false }) : [],
    }
  })
}

async function extractPdfText(buffer: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const content = await page.getTextContent()
    const lineMap = new Map<number, Array<{ x: number, text: string }>>()
    content.items.forEach((item: any) => {
      const text = String(item.str || '').trim()
      if (!text)
        return
      const y = Math.round(Number(item.transform?.[5] || 0) / 3) * 3
      const x = Number(item.transform?.[4] || 0)
      if (!lineMap.has(y))
        lineMap.set(y, [])
      lineMap.get(y)!.push({ x, text })
    })
    pages.push([...lineMap.entries()]
      .sort((left, right) => right[0] - left[0])
      .map(([, items]) => items.sort((left, right) => left.x - right.x).map(item => item.text).join(' '))
      .join('\n'))
  }
  return pages.join('\n')
}

globalThis.onmessage = async (event: MessageEvent<TransportImportWorkerRequest>) => {
  const { id, type, buffer } = event.data
  try {
    const result = type === 'workbook' ? parseWorkbook(buffer) : await extractPdfText(buffer)
    globalThis.postMessage({ id, ok: true, result } satisfies TransportImportWorkerResponse)
  }
  catch (error) {
    globalThis.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : '文件解析失败',
    } satisfies TransportImportWorkerResponse)
  }
}
