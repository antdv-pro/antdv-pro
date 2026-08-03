import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

const root = process.cwd()

export const runtimeDataRoot = join(root, 'storage/runtime')
export const runtimeJsonDataRoot = join(runtimeDataRoot, 'json')

export const testDataRoot = join(root, 'storage/test-data')
export const testJsonDataRoot = join(testDataRoot, 'json')
export const testSqlDataRoot = join(testDataRoot, 'sql')
export const testMysqlInitRoot = join(testDataRoot, 'mysql-init')

export function resolveRuntimeJsonDataFile(filename: string) {
  return join(runtimeJsonDataRoot, filename)
}

/**
 * Resolve mutable application data to the runtime directory. Existing seed data
 * is copied once so upgrades do not reset records entered by users.
 */
export function resolveJsonDataFile(filename: string) {
  const runtimeFile = resolveRuntimeJsonDataFile(filename)
  const seedFile = join(testJsonDataRoot, filename)
  if (!existsSync(runtimeFile) && existsSync(seedFile)) {
    mkdirSync(dirname(runtimeFile), { recursive: true })
    copyFileSync(seedFile, runtimeFile)
  }
  return runtimeFile
}
