import { resolve } from 'path'
import { execaCommand } from 'execa'
import color from 'picocolors'
import fsExtra from 'fs-extra'

// 检测servers是否存在
const isServersExist = fsExtra.existsSync(resolve(process.cwd(), 'servers'))
if (isServersExist) {
  // 检测 package.json文件是否存在
  const isPackageJsonExist = fsExtra.existsSync(resolve(process.cwd(), './servers/package.json'))
  if (isPackageJsonExist) {
    // console.log('Sd')
    const data = execaCommand('pnpm -F servers dev')
    data.stdout.on('data', (data) => {
      const str = data.toString()
      if (str.includes('Unable to find an available port')) {
        // 接口被占用
        console.log(color.red('端口【8899】被占用，请确检查'))
        process.exit(1)
      }
    })
  }
}
