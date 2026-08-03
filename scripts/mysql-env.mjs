import fs from 'node:fs'
import path from 'node:path'

export function loadProductionEnv(root = process.cwd()) {
  const envPath = path.join(root, '.env.production')
  if (!fs.existsSync(envPath))
    return

  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('='))
      continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index)
    const value = trimmed.slice(index + 1)
    if (!process.env[key])
      process.env[key] = value
  }
}

export function requiredMysqlEnv(name) {
  const value = process.env[name]
  if (!value || /^your-|^replace_|change_me/i.test(value))
    throw new Error(`${name} 未配置或仍为占位值`)
  return value
}

export function mysqlConnectionOptions(options = {}) {
  const hasDatabaseOption = Object.prototype.hasOwnProperty.call(options, 'database')
  return {
    host: requiredMysqlEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: requiredMysqlEnv('DB_USER'),
    password: requiredMysqlEnv('DB_PASSWORD'),
    ...(hasDatabaseOption ? (options.database ? { database: options.database } : {}) : { database: requiredMysqlEnv('DB_NAME') }),
    charset: 'utf8mb4',
    multipleStatements: Boolean(options.multipleStatements),
  }
}

export function assertWriteEnabled(envName, action) {
  if (process.env[envName] !== 'true')
    throw new Error(`${action} 默认仅预览。确认后请设置 ${envName}=true 再执行。`)
}
