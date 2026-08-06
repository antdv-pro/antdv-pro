import { afterEach, describe, expect, it, vi } from 'vitest'
import { gpsProviderService } from './provider-service'
import { runGpsSyncTask, startGpsSyncScheduler, stopGpsSyncScheduler } from './sync-scheduler'

afterEach(() => {
  stopGpsSyncScheduler()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('gps sync scheduler', () => {
  it('prevents the same synchronization task from overlapping', async () => {
    vi.stubEnv('GPS_808_TOKEN', 'test-token')
    vi.spyOn(gpsProviderService, 'listConfigs').mockResolvedValue([{ provider: '808gps', enabled: true }] as any)
    let release!: () => void
    const run = vi.fn(() => new Promise<void>(resolve => release = resolve))
    const task = { name: 'locations', intervalMs: 1_000, run }
    const first = runGpsSyncTask(task)
    await Promise.resolve()
    await expect(runGpsSyncTask(task)).resolves.toBe(false)
    release()
    await expect(first).resolves.toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })

  it('skips supplier calls when no provider is configured', async () => {
    vi.stubEnv('GPS_808_TOKEN', 'test-token')
    vi.spyOn(gpsProviderService, 'listConfigs').mockResolvedValue([{ provider: '', enabled: true }] as any)
    const run = vi.fn(async () => undefined)
    await expect(runGpsSyncTask({ name: 'locations', intervalMs: 1_000, run })).resolves.toBe(true)
    expect(run).not.toHaveBeenCalled()
  })

  it('skips supplier calls when runtime credentials are missing', async () => {
    vi.stubEnv('GPS_808_TOKEN', '')
    vi.stubEnv('GPS_808_USERNAME', '')
    vi.stubEnv('GPS_808_PASSWORD', '')
    vi.spyOn(gpsProviderService, 'listConfigs').mockResolvedValue([{ provider: '808gps', enabled: true }] as any)
    const run = vi.fn(async () => undefined)
    await expect(runGpsSyncTask({ name: 'locations', intervalMs: 1_000, run })).resolves.toBe(true)
    expect(run).not.toHaveBeenCalled()
  })

  it('does not start timers in the test environment', () => {
    expect(startGpsSyncScheduler()).toBe(false)
  })
})
