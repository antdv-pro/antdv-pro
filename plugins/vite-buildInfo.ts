import { readdir, stat } from 'fs'
import type { Plugin } from 'vite'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import duration from 'dayjs/plugin/duration'
import pkg from 'picocolors'
const { green, blue, bold } = pkg
dayjs.extend(duration)

const staticPath = 'dist'
const fileListTotal: number[] = []

// eslint-disable-next-line @typescript-eslint/ban-types
const recursiveDirectory = (folder: string, callback: Function): void => {
  readdir(folder, (err, files: string[]) => {
    if (err) throw err
    let count = 0
    const checkEnd = () => {
      ++count === files.length && callback()
    }
    files.forEach((item: string) => {
      stat(`${folder}/${item}`, async (err, stats) => {
        if (err) throw err
        if (stats.isFile()) {
          fileListTotal.push(stats.size)
          checkEnd()
        }
        else if (stats.isDirectory()) {
          recursiveDirectory(`${folder}/${item}/`, checkEnd)
        }
      })
    })
    files.length === 0 && callback()
  })
}

const sum = (arr: number[]) => {
  return arr.reduce((t: number, c: number) => {
    return t + c
  }, 0)
}
const formatBytes = (a: number, b?: number): string => {
  if (a === 0) return '0 Bytes'
  const c = 1024
  const d = b || 2
  const e = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const f = Math.floor(Math.log(a) / Math.log(c))
  return `${parseFloat((a / Math.pow(c, f)).toFixed(d))} ${e[f]}`
}

export const viteBuildInfo = (name: string): Plugin => {
  let config: { command: string }
  let startTime: Dayjs
  let endTime: Dayjs
  return {
    name: 'vite:buildInfo',
    configResolved(resolvedConfig: { command: string }) {
      config = resolvedConfig
    },
    buildStart() {
      console.log(
        bold(
          green(
            `👏欢迎使用${blue(`[${name}]`)}，现在正全力为您${config.command === 'build' ? '打包' : '编译'
            }`,
          ),
        ),
      )
      if (config.command === 'build')
        startTime = dayjs(new Date())
    },
    closeBundle() {
      if (config.command === 'build') {
        endTime = dayjs(new Date())
        recursiveDirectory(staticPath, () => {
          console.log(
            bold(
              green(
                `恭喜打包完成🎉（总用时${dayjs
                  .duration(endTime.diff(startTime))
                  .format('mm分ss秒')}，打包后的大小为${formatBytes(
                    sum(fileListTotal),
                  )}）`,
              ),
            ),
          )
        })
      }
    },
  }
}
