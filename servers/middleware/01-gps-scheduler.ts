import { defineEventHandler } from 'h3'
import { startGpsSyncScheduler } from '../services/gps/sync-scheduler'

export default defineEventHandler(() => {
  startGpsSyncScheduler()
})
