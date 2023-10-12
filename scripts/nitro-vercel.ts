import * as process from 'node:process'
import { $ } from 'execa'

if (process.env.VERCEL)
  $`rm -rf ./vercel.json`
