import process from 'node:process'
import { gpsAlarmService } from './alarm-service'
import { gpsLocationService } from './location-service'
import { gpsProviderService } from './provider-service'

interface SchedulerTask {
  name: string
  intervalMs: number
  run: () => Promise<unknown>
}

interface SchedulerTimer {
  unref?: () => void
}

const timers: SchedulerTimer[] = []
const runningTasks = new Set<string>()
let started = false

function positiveMs(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function createGpsSyncTasks(): SchedulerTask[] {
  return [
    { name: 'locations', intervalMs: positiveMs('GPS_LOCATION_SYNC_INTERVAL_MS', 2 * 60_000), run: () => gpsLocationService.syncLatest() },
    { name: 'alarms', intervalMs: positiveMs('GPS_ALARM_SYNC_INTERVAL_MS', 5 * 60_000), run: () => gpsAlarmService.sync() },
    { name: 'devices', intervalMs: positiveMs('GPS_DEVICE_SYNC_INTERVAL_MS', 60 * 60_000), run: () => gpsProviderService.syncDevices() },
  ]
}

export async function hasConfiguredGpsProvider() {
  const configs = await gpsProviderService.listConfigs()
  const hasRuntimeCredentials = Boolean(
    process.env.GPS_808_TOKEN
    || (process.env.GPS_808_USERNAME && process.env.GPS_808_PASSWORD),
  )
  return hasRuntimeCredentials
    && configs.some(config => config.enabled && config.provider === '808gps')
}

export async function runGpsSyncTask(task: SchedulerTask) {
  if (runningTasks.has(task.name))
    return false
  runningTasks.add(task.name)
  try {
    if (!await hasConfiguredGpsProvider())
      return true
    await task.run()
    return true
  }
  catch (error) {
    console.error(`[gps-scheduler] ${task.name} sync failed`, error)
    return false
  }
  finally {
    runningTasks.delete(task.name)
  }
}

export function startGpsSyncScheduler() {
  const explicitlyEnabled = process.env.GPS_SYNC_SCHEDULER_ENABLED === 'true'
  const productionDefault = process.env.NODE_ENV === 'production' && process.env.GPS_SYNC_SCHEDULER_ENABLED !== 'false'
  if (started || (!explicitlyEnabled && !productionDefault))
    return false
  started = true
  for (const task of createGpsSyncTasks()) {
    const timer = setInterval(() => void runGpsSyncTask(task), task.intervalMs)
    timer.unref?.()
    timers.push(timer)
  }
  return true
}

export function stopGpsSyncScheduler() {
  timers.splice(0).forEach(timer => clearInterval(timer as ReturnType<typeof setInterval>))
  runningTasks.clear()
  started = false
}
