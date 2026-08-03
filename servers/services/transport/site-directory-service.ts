import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createError } from 'h3'
import { requireMysql } from '../../utils/mysql'
import { runtimeConfig } from '../../utils/runtime-config'

export interface SiteDirectoryInput {
  name: string
  url: string
  category: string
  username: string
  password: string
  owner: string
  favorite?: boolean
}

const key = () => createHash('sha256').update(runtimeConfig.security.sessionSecret).digest()

function encrypt(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`
}

function decrypt(value: string) {
  if (!value)
    return ''
  const [iv, tag, encrypted] = value.split('.')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8')
}

function normalize(input: SiteDirectoryInput) {
  const name = String(input.name || '').trim()
  const username = String(input.username || '').trim()
  const owner = String(input.owner || '').trim()
  const category = String(input.category || '').trim()
  const password = String(input.password || '')
  let parsed: URL
  try {
    parsed = new URL(String(input.url || '').trim())
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: '请输入有效的完整网址' })
  }
  if (!name || !username || !password || !owner || !category || !['http:', 'https:'].includes(parsed.protocol))
    throw createError({ statusCode: 400, statusMessage: '请完整填写站点资料' })
  return { name, url: parsed.toString(), domain: parsed.hostname, category, username, password, owner, favorite: Boolean(input.favorite) }
}

export const siteDirectoryService = {
  list: () => requireMysql(async (db) => {
    const [rows]: any = await db.query('SELECT id,name,url,domain,category,username,password_cipher,owner,favorite,created_at AS createdAt,updated_at AS updatedAt FROM transport_site_directory ORDER BY favorite DESC, updated_at DESC')
    return rows.map((row: any) => ({ ...row, password: decrypt(row.password_cipher), password_cipher: undefined }))
  }),
  async save(id: number | undefined, input: SiteDirectoryInput, userId: number) {
    const item = normalize(input)
    return requireMysql(async (db) => {
      if (id) {
        const [result]: any = await db.execute('UPDATE transport_site_directory SET name=?,url=?,domain=?,category=?,username=?,password_cipher=?,owner=?,favorite=?,updated_by=? WHERE id=?', [item.name, item.url, item.domain, item.category, item.username, encrypt(item.password), item.owner, item.favorite, userId, id])
        if (!result.affectedRows)
          throw createError({ statusCode: 404, statusMessage: '站点不存在' })
        return { id, ...item }
      }
      const [result]: any = await db.execute('INSERT INTO transport_site_directory (name,url,domain,category,username,password_cipher,owner,favorite,updated_by) VALUES (?,?,?,?,?,?,?,?,?)', [item.name, item.url, item.domain, item.category, item.username, encrypt(item.password), item.owner, item.favorite, userId])
      return { id: result.insertId, ...item }
    })
  },
  remove: (id: number) => requireMysql(async (db) => {
    const [result]: any = await db.execute('DELETE FROM transport_site_directory WHERE id=?', [id])
    if (!result.affectedRows)
      throw createError({ statusCode: 404, statusMessage: '站点不存在' })
  }),
}
