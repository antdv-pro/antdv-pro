import { defineEventHandler, setResponseStatus } from 'h3'
import { checkMysqlConnection } from '../utils/mysql'

export default defineEventHandler(async (event) => {
  const database = await checkMysqlConnection()
  if (!database.ready)
    setResponseStatus(event, 503)

  return {
    code: database.ready ? 200 : 503,
    msg: database.ready ? 'ready' : 'database unavailable',
    data: { database },
  }
})
