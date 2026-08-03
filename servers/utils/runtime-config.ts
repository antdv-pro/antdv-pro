import process from 'node:process'

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function readList(name: string, fallback: string[]) {
  const value = process.env[name]
  return value ? value.split(',').map(item => item.trim()).filter(Boolean) : fallback
}

export const runtimeConfig = {
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: readNumber('PORT', 3000),
  },
  database: {
    client: process.env.DB_CLIENT || 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: readNumber('DB_PORT', 3306),
    name: process.env.DB_NAME || 'enterprise_system',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    required: process.env.DB_REQUIRED === 'true' || process.env.NODE_ENV === 'production',
    connectTimeoutMs: readNumber('DB_CONNECT_TIMEOUT_MS', 5000),
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: readNumber('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || '',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    sessionTtlSeconds: readNumber('SESSION_TTL_SECONDS', 8 * 60 * 60),
  },
  oss: {
    provider: process.env.OSS_PROVIDER || 'local',
    region: process.env.OSS_REGION || '',
    bucket: process.env.OSS_BUCKET || '',
    endpoint: process.env.OSS_ENDPOINT || '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    uploadDir: process.env.OSS_UPLOAD_DIR || 'enterprise-system',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSizeMb: readNumber('UPLOAD_MAX_SIZE_MB', 20),
    allowedExtensions: readList('UPLOAD_ALLOWED_EXTENSIONS', ['.jpg', '.jpeg', '.png', '.pdf', '.xlsx', '.xls', '.csv', '.doc', '.docx']),
  },
  log: {
    dir: process.env.LOG_DIR || './logs',
    level: process.env.LOG_LEVEL || 'info',
  },
  payment: {
    provider: process.env.PAYMENT_PROVIDER || (process.env.NODE_ENV === 'production' ? 'disabled' : 'mock'),
    endpoint: process.env.PAYMENT_PROVIDER_ENDPOINT || '',
    merchantId: process.env.PAYMENT_MERCHANT_ID || '',
    apiKey: process.env.PAYMENT_API_KEY || '',
    callbackSecret: process.env.PAYMENT_CALLBACK_SECRET || '',
    callbackUrl: process.env.PAYMENT_CALLBACK_URL || '',
  },
}

export function validateProductionConfig() {
  if (runtimeConfig.app.nodeEnv !== 'production')
    return

  const missing: string[] = []
  for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD', 'JWT_SECRET', 'SESSION_SECRET']) {
    if (!process.env[key] || String(process.env[key]).startsWith('change_me'))
      missing.push(key)
  }

  if (runtimeConfig.security.jwtSecret.length < 32)
    missing.push('JWT_SECRET(至少32位)')
  if (runtimeConfig.security.sessionSecret.length < 32)
    missing.push('SESSION_SECRET(至少32位)')
  if (runtimeConfig.payment.provider !== 'disabled' && runtimeConfig.payment.callbackSecret.length < 32)
    missing.push('PAYMENT_CALLBACK_SECRET(至少32位)')
  if (!['disabled', 'mock', 'http'].includes(runtimeConfig.payment.provider))
    missing.push('PAYMENT_PROVIDER(disabled/mock/http)')
  if (runtimeConfig.payment.provider === 'http' && (!runtimeConfig.payment.endpoint || !runtimeConfig.payment.apiKey))
    missing.push('PAYMENT_PROVIDER_ENDPOINT/PAYMENT_API_KEY')
  const initialPassword = String(process.env.ADMIN_INITIAL_PASSWORD || '')
  if (!initialPassword || String(initialPassword).startsWith('change_me') || initialPassword.length < 12 || ['admin', '123456', 'password'].includes(initialPassword.toLowerCase()))
    missing.push('ADMIN_INITIAL_PASSWORD(至少12位且不能使用常见默认值)')

  if (missing.length)
    throw new Error(`生产环境缺少安全配置: ${[...new Set(missing)].join(', ')}`)
}
