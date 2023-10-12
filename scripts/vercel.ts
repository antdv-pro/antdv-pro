import { $ } from 'execa'

export async function main() {
  // 判断当前是不是vercel的环境
  $`rm -rf ./vercel.json`
}

main()
