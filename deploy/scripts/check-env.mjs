const required = [
  'DB_PASSWORD',
  'REDIS_PASSWORD',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ADMIN_INITIAL_PASSWORD',
]

if ((process.env.DB_HOST || '').toLowerCase() === 'mysql')
  required.push('MYSQL_ROOT_PASSWORD')

const weak = []
const missing = []

for (const key of required) {
  const value = process.env[key]
  if (!value)
    missing.push(key)
  else if (value.startsWith('change_me') || value.length < (key === 'ADMIN_INITIAL_PASSWORD' ? 12 : 16) || ['admin', '123456', 'password'].includes(value.toLowerCase()))
    weak.push(key)
}

if (missing.length || weak.length) {
  if (missing.length)
    console.error(`Missing env: ${missing.join(', ')}`)
  if (weak.length)
    console.error(`Weak placeholder env: ${weak.join(', ')}`)
  process.exit(1)
}

console.log('Production environment variables look usable.')
