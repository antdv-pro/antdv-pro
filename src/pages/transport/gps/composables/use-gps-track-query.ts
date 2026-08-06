import type { Ref } from 'vue'
import type { GpsLocationLatest } from '~@/api/gps'
import dayjs from 'dayjs'
import { ref } from 'vue'
import { getGpsVehicleTrackApi } from '~@/api/gps'

export function useGpsTrackQuery(options: {
  message: ReturnType<typeof useMessage>
  selectedVehicleId: Ref<string>
  provider: Ref<'808gps'>
  pause: () => void
  onLoaded: () => void
}) {
  const points = ref<GpsLocationLatest[]>([])
  const loading = ref(false)
  const range = ref<[any, any]>([dayjs().subtract(24, 'hour'), dayjs()])

  async function load(vehicleId = options.selectedVehicleId.value) {
    if (!vehicleId)
      return options.message.warning('请选择车辆')
    if (range.value[0]?.isAfter?.(range.value[1]))
      return options.message.warning('轨迹查询开始时间不能晚于结束时间')
    loading.value = true
    options.pause()
    try {
      const res = await getGpsVehicleTrackApi(vehicleId, {
        startTime: range.value[0]?.toISOString?.(),
        endTime: range.value[1]?.toISOString?.(),
        provider: options.provider.value,
      })
      points.value = res.data?.points ?? []
      options.onLoaded()
      if (!points.value.length)
        options.message.info('所选时间段内暂无轨迹数据')
    }
    catch (error: any) {
      points.value = []
      const timedOut = error?.code === 'ECONNABORTED' || String(error?.message ?? '').includes('timeout')
      options.message.error(timedOut ? '轨迹数据响应超时，请缩小查询时间范围后重试' : (error?.response?.data?.msg || error?.message || '轨迹查询失败，请稍后重试'))
    }
    finally {
      loading.value = false
    }
  }

  return { trackLoading: loading, trackPoints: points, trackRange: range, loadTrack: load }
}
