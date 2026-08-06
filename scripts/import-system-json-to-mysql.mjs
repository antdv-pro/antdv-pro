import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { loadProductionEnv, mysqlConnectionOptions } from './mysql-env.mjs'

const root = process.cwd()
const dataPath = process.env.SYSTEM_IMPORT_FILE
  ? path.resolve(root, process.env.SYSTEM_IMPORT_FILE)
  : path.join(root, 'storage/test-data/json/system.json')

loadProductionEnv(root)

if (!fs.existsSync(dataPath))
  throw new Error(`导入文件不存在: ${dataPath}`)

const system = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

const connection = await mysql.createConnection(mysqlConnectionOptions())

function toDateTime(value) {
  return value ? String(value).replace(/\//g, '-').trim() : null
}

await connection.beginTransaction()

try {
  for (const item of system.organizations.filter(item => item.type === 'company')) {
    await connection.execute(
      `INSERT INTO sys_company (id, code, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), status = VALUES(status), updated_at = NOW()`,
      [Number(String(item.id).replace(/\D/g, '')) || 1, item.code, item.name, item.status],
    )
  }

  const companyId = 1
  for (const item of system.organizations.filter(item => item.type === 'department')) {
    await connection.execute(
      `INSERT INTO sys_department (id, company_id, parent_id, code, name, leader_user_id, sort_no, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), leader_user_id = VALUES(leader_user_id), sort_no = VALUES(sort_no), status = VALUES(status), updated_at = NOW()`,
      [Number(String(item.id).replace(/\D/g, '')) || 0, companyId, item.parentId ? Number(String(item.parentId).replace(/\D/g, '')) || null : null, item.code, item.name, item.leaderId || null, item.sortNo || 0, item.status],
    )
  }

  for (const item of system.organizations.filter(item => item.type === 'post')) {
    await connection.execute(
      `INSERT INTO sys_post (id, dept_id, code, name, sort_no, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), sort_no = VALUES(sort_no), status = VALUES(status), updated_at = NOW()`,
      [Number(String(item.id).replace(/\D/g, '')) || 0, item.parentId ? Number(String(item.parentId).replace(/\D/g, '')) || 0 : 0, item.code, item.name, item.sortNo || 0, item.status],
    )
  }

  for (const role of system.roles) {
    await connection.execute(
      `INSERT INTO sys_role (id, code, name, data_scope, status, remark, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), data_scope = VALUES(data_scope), status = VALUES(status), remark = VALUES(remark), updated_at = NOW()`,
      [Number(String(role.id).replace(/\D/g, '')) || 0, role.code, role.name, role.dataScope, role.status, role.remark || null],
    )
  }

  for (const user of system.users) {
    await connection.execute(
      `INSERT INTO sys_user (id, username, nickname, mobile, email, password_salt, password_hash, company_id, dept_id, post_id, leader_user_id, status, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), mobile = VALUES(mobile), email = VALUES(email), company_id = VALUES(company_id), dept_id = VALUES(dept_id), post_id = VALUES(post_id), leader_user_id = VALUES(leader_user_id), status = VALUES(status), last_login_at = VALUES(last_login_at), updated_at = VALUES(updated_at)`,
      [user.id, user.username, user.nickname, user.mobile || null, user.email || null, user.passwordSalt, user.passwordHash, Number(String(user.companyId).replace(/\D/g, '')) || null, Number(String(user.deptId).replace(/\D/g, '')) || null, Number(String(user.postId).replace(/\D/g, '')) || null, user.leaderId || null, user.status, toDateTime(user.lastLoginAt), toDateTime(user.createdAt), toDateTime(user.updatedAt)],
    )

    for (const roleId of user.roleIds || []) {
      await connection.execute(
        `INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`,
        [user.id, Number(String(roleId).replace(/\D/g, '')) || 0],
      )
    }
  }

  for (const item of system.dictionaries) {
    await connection.execute(
      `INSERT INTO sys_dict (id, type, type_name, label, value, sort_no, status, remark, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE type_name = VALUES(type_name), label = VALUES(label), sort_no = VALUES(sort_no), status = VALUES(status), remark = VALUES(remark), updated_at = NOW()`,
      [Number(String(item.id).replace(/\D/g, '')) || 0, item.type, item.typeName, item.label, item.value, item.sortNo || 0, item.status, item.remark || null],
    )
  }

  await connection.commit()
  console.log(`${path.relative(root, dataPath)} 已导入 MySQL`)
}
catch (error) {
  await connection.rollback()
  console.error('导入失败:', error)
  process.exitCode = 1
}
finally {
  await connection.end()
}
