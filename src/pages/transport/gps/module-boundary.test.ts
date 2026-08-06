import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('gPS monitor component boundaries', () => {
  it('keeps track and alarm views in dedicated panels', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/gps/index.vue'), 'utf8')
    expect(source).toContain('import GpsTrackPanel from \'./components/gps-track-panel.vue\'')
    expect(source).toContain('import GpsAlarmPanel from \'./components/gps-alarm-panel.vue\'')
    expect(source).toContain('import GpsDevicePanel from \'./components/gps-device-panel.vue\'')
    expect(source).toContain('import GpsGeofencePanel from \'./components/gps-geofence-panel.vue\'')
    expect(source).toContain('import GpsProviderPanel from \'./components/gps-provider-panel.vue\'')
    expect(source).toContain('import GpsLogPanel from \'./components/gps-log-panel.vue\'')
    expect(source).toContain('<GpsTrackPanel')
    expect(source).toContain('<GpsAlarmPanel')
    expect(source).not.toContain(':columns="trackTableColumns" :data-source="trackClassifiedPoints"')
    expect(source).not.toContain(':columns="alarmTableColumns" :data-source="filteredAlarms"')
    expect(source).toContain('<GpsDevicePanel')
    expect(source).toContain('<GpsGeofencePanel')
    expect(source).toContain('<GpsProviderPanel')
    expect(source).toContain('<GpsLogPanel')
    expect(source).not.toContain('<a-table row-key="id" :data-source="geofences">')
    expect(source.split('\n').length).toBeLessThanOrEqual(1750)
  })

  it('keeps API synchronization and timer ownership out of view panels', () => {
    const components = ['gps-track-panel.vue', 'gps-alarm-panel.vue', 'gps-device-panel.vue', 'gps-provider-panel.vue', 'gps-log-panel.vue', 'gps-geofence-panel.vue']
      .map(file => fs.readFileSync(path.resolve('src/pages/transport/gps/components', file), 'utf8'))
      .join('\n')
    expect(components).not.toContain('syncGps')
    expect(components).not.toContain('setInterval')
    expect(components).not.toContain('new Scene')
  })

  it('leaves scheduled provider synchronization to the server', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/gps/index.vue'), 'utf8')
    expect(source).not.toContain('async function autoSync')
    expect(source).not.toContain('{ silent: true }')
    const refreshBody = source.match(/async function refreshMonitorData\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(refreshBody).toContain('await loadData()')
    expect(refreshBody).not.toContain('syncGps')
  })
})
