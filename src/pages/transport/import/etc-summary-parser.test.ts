import { describe, expect, it } from 'vitest'
import { extractEtcSummaryJourneys, extractEtcSummaryStations } from './etc-parser'

describe('etc summary station extraction', () => {
  it('keeps station names exactly as displayed without requiring a suffix', () => {
    const text = '青·青海中\n灶火站\n20251227\n1 至 314.45 314.45\n20251227\n青·青海中\n灶火站\n青·青海甘\n森站\n同1\n20251227\n2 至 314.45 314.45\n20251227\n青·青海甘\n森站\n共2段行程'
    expect(extractEtcSummaryStations(text)).toEqual([
      '青·青海中灶火站',
      '青·青海中灶火站',
      '青·青海甘森站',
      '青·青海甘森站',
    ])
  })

  it('preserves names that do and do not end in 收费站', () => {
    const text = '陕·陕西汉\n中勉县\n20260601\n1 至 42.75 42.75\n20260601\n陕·陕西汉\n中勉县\n陕·陕西韩\n家坝收费站\n20260601\n2 至 82.35 82.35\n20260601\n陕·陕西勉\n县收费站\n共2段行程'
    expect(extractEtcSummaryStations(text)).toEqual([
      '陕·陕西汉中勉县',
      '陕·陕西汉中勉县',
      '陕·陕西韩家坝收费站',
      '陕·陕西勉县收费站',
    ])
  })

  it('reads single and split-invoice journey amount layouts', () => {
    expect(extractEtcSummaryJourneys('20250803\n1 至 433.92\n20250804')).toEqual([{ index: '1', amount: '433.92' }])
    expect(extractEtcSummaryJourneys('20260406\n1 至 796.09\n20260407\n20260418\n2 99.75 99.75 3 * 123\n20260418 至')).toEqual([
      { index: '1', amount: '796.09' },
      { index: '2', amount: '99.75' },
    ])
    expect(extractEtcSummaryJourneys('26 20241023 至 29.45 29.45 号发')).toEqual([{ index: '26', amount: '29.45' }])
    expect(extractEtcSummaryJourneys('10 20251208 站 99.75 99.75 * 123')).toEqual([{ index: '10', amount: '99.75' }])
    expect(extractEtcSummaryJourneys('24 20251129 陕·陕西宁 99.75 99.75 号发')).toEqual([{ index: '24', amount: '99.75' }])
  })
})
