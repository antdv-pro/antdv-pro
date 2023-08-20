import { resolve } from 'path'
import { execaCommand } from 'execa'
import fsExtra from 'fs-extra'

// 检测servers是否存在
const isServersExist = fsExtra.existsSync(resolve(process.cwd(), 'servers'))
if (isServersExist) {
  // 检测 package.json文件是否存在
  const isPackageJsonExist = fsExtra.existsSync(resolve(process.cwd(), './servers/package.json'))
  if (isPackageJsonExist) {
    // console.log('Sd')
    execaCommand('pnpm -F servers dev')
  }
}
