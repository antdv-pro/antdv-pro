<script setup>
import { HeatmapLayer, Mapbox, PointLayer, Scene } from '@antv/l7'
import mapGrid from './map-grid.js'
import mapData from './map-data.js'

let scene
let layer
let pointLayer
let pointLayerText
onMounted(() => {
  scene = new Scene({
    id: 'map',
    map: new Mapbox({
      style: {
        position: 'relative',
        width: '100%',
        height: '452px',
        version: 8,
        sources: {},
        layers: [],
      },
      center: [110.19382669582967, 50.258134],
      pitch: 0,
      zoom: 1,
    }),
  })
  const grid = mapGrid
  const data = mapData
  layer = new HeatmapLayer({})
  layer.source(
    grid,
    {
      transforms: [
        {
          type: 'hexagon',
          size: 8e5,
          field: 'capacity',
          method: 'sum',
        },
      ],
    },
  ).shape('hexagon').color('#ddd').style(
    {
      coverage: 0.7,
      opacity: 0.8,
    },
  )
  scene.addLayer(layer)
  pointLayer = new PointLayer({
    autoFit: true,
  })
  pointLayer.source(data).shape('circle').size('cum_conf', [0, 17]).scale('cum_conf', {
    type: 'quantile',
  }).color('cum_conf', [
    '#eff3ff',
    '#c6dbef',
    '#9ecae1',
    '#6baed6',
    '#4292c6',
    '#2171b5',
    '#084594',
  ]).active({ color: '#0c2c84' }).style({
    opacity: 0.8,
  })
  pointLayerText = new PointLayer({
    autoFit: true,
  })
  pointLayerText.source(data).shape('Short_Name_ZH', 'text').filter('cum_conf', (v) => {
    return v > 2e3
  }).size(12).active(true).color('#fff').style({
    opacity: 1,
    strokeOpacity: 1,
    strokeWidth: 0,
  })
  scene.addLayer(pointLayer)
  scene.addLayer(pointLayerText)
})
onBeforeUnmount(() => {
  layer.destroy?.()
  pointLayerText?.destroy?.()
  pointLayer?.destroy?.()
  scene.destroy?.()
})
</script>

<template>
  <div id="map" />
</template>

<style scoped lang="less">
 #map{
   position: relative;
   width: 100%;
   height: 452px;
 }
</style>
