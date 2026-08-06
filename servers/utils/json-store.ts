import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'

export function readJsonFile<T>(file: string, fallback: T): T {
  if (!existsSync(file))
    return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T
  }
  catch {
    return fallback
  }
}

export function writeJsonFile<T>(file: string, data: T) {
  mkdirSync(dirname(file), { recursive: true })
  const temporaryFile = `${file}.${process.pid}.tmp`
  try {
    writeFileSync(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 })
    renameSync(temporaryFile, file)
  }
  catch (error) {
    rmSync(temporaryFile, { force: true })
    throw error
  }
}
