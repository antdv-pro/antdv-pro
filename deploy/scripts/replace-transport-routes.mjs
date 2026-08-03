import fs from 'node:fs/promises'
import process from 'node:process'
import mysql from 'mysql2/promise.js'

const apply = process.argv.includes('--apply')
const inputPath = process.argv.find(argument => argument.endsWith('.json'))

if (!inputPath)
  throw new Error('Usage: node replace-transport-routes.mjs <routes.json> [--apply]')

const routes = JSON.parse(await fs.readFile(inputPath, 'utf8'))
if (!Array.isArray(routes) || routes.length === 0)
  throw new Error('Route input must be a non-empty JSON array')

const codes = routes.map(route => String(route?.code || '').trim())
const names = routes.map(route => String(route?.name || '').trim())
if (codes.some(code => !code) || new Set(codes).size !== codes.length)
  throw new Error('Route codes must be non-empty and unique')
if (names.some(name => !name) || new Set(names).size !== names.length)
  throw new Error('Route names must be non-empty and unique')

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
})

try {
  const [beforeRows] = await connection.query(
    'SELECT category, COUNT(*) AS count FROM transport_base_data GROUP BY category ORDER BY category',
  )
  const before = Object.fromEntries(beforeRows.map(row => [row.category, Number(row.count)]))

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', before, incomingRoutes: routes.length }))
  }
  else {
    await connection.beginTransaction()
    await connection.query('SELECT id FROM transport_base_data WHERE category = \'route\' FOR UPDATE')
    await connection.execute('DELETE FROM transport_base_data WHERE category = \'route\'')

    for (const route of routes) {
      const code = String(route.code).trim()
      await connection.execute(
        'INSERT INTO transport_base_data (id, category, code, record_json) VALUES (?, ?, ?, CAST(? AS JSON))',
        [`route:${code}`, 'route', code, JSON.stringify(route)],
      )
    }

    const [afterRows] = await connection.query(
      'SELECT category, COUNT(*) AS count FROM transport_base_data GROUP BY category ORDER BY category',
    )
    const after = Object.fromEntries(afterRows.map(row => [row.category, Number(row.count)]))
    const unchangedCategories = Object.entries(before)
      .filter(([category]) => category !== 'route')
      .every(([category, count]) => after[category] === count)

    if (after.route !== routes.length)
      throw new Error(`Route verification failed: expected ${routes.length}, received ${after.route || 0}`)
    if (!unchangedCategories)
      throw new Error('Non-route base data changed during route replacement')

    await connection.commit()
    console.log(JSON.stringify({ mode: 'applied', before, after, incomingRoutes: routes.length }))
  }
}
catch (error) {
  await connection.rollback()
  throw error
}
finally {
  await connection.end()
}
