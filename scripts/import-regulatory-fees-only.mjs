import fs from 'node:fs'
import mysql from 'mysql2/promise'

const input = process.argv[2] || 'storage/test-data/json/regulatory-fees.json'
const records = JSON.parse(fs.readFileSync(input, 'utf8'))
if (!Array.isArray(records) || records.length !== 498)
  throw new Error(`规费数据数量异常: ${records?.length}`)

const requiredTypes = new Set(['交强险', '主车商业险', '挂车商业险', '车辆意外险', '承运人责任险', 'GPS年费', '主车行驶证', '挂车行驶证', '气瓶年审', '罐体检测', '安全阀年检', '压力表校验'])
if (records.some(item => !requiredTypes.has(item.feeType) || !item.plateNo || !item.validStartDate || !item.validEndDate))
  throw new Error('规费数据包含无效记录')

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
})
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
try {
  await connection.beginTransaction()
  await connection.query(`CREATE TABLE regulatory_fee_backup_${stamp} AS SELECT * FROM regulatory_fee`)
  await connection.query('UPDATE regulatory_fee SET deleted_at = NOW() WHERE deleted_at IS NULL')
  const sql = `INSERT INTO regulatory_fee (id, fee_name, fee_type, plate_no, trailer_no, area, total_amount, valid_start_date, valid_end_date, valid_months, monthly_amortized_amount, manual_status, approval_status, remark, created_by, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) ON DUPLICATE KEY UPDATE fee_name=VALUES(fee_name), fee_type=VALUES(fee_type), plate_no=VALUES(plate_no), trailer_no=VALUES(trailer_no), area=VALUES(area), total_amount=VALUES(total_amount), valid_start_date=VALUES(valid_start_date), valid_end_date=VALUES(valid_end_date), valid_months=VALUES(valid_months), monthly_amortized_amount=VALUES(monthly_amortized_amount), manual_status=VALUES(manual_status), approval_status=VALUES(approval_status), remark=VALUES(remark), created_by=VALUES(created_by), created_at=VALUES(created_at), updated_at=VALUES(updated_at), deleted_at=NULL`
  for (const item of records) {
    await connection.execute(sql, [item.id, item.feeName, item.feeType, item.plateNo, item.trailerNo || null, item.area || null, Number(item.totalAmount || 0), item.validStartDate.slice(0, 10), item.validEndDate.slice(0, 10), Number(item.validMonths || 0), Number(item.monthlyAmortizedAmount || 0), item.manualStatus || 'enabled', item.approvalStatus || '草稿', item.remark || null, item.createdBy == null ? null : String(item.createdBy), item.createdAt || new Date(), item.updatedAt || new Date()])
  }
  await connection.commit()
  console.log(JSON.stringify({ imported: records.length, backup: `regulatory_fee_backup_${stamp}`, amount: records.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0).toFixed(2) }))
}
catch (error) {
  await connection.rollback()
  throw error
}
finally {
  await connection.end()
}
