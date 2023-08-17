import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  timing: true,
  esbuild: {
    options: {
      target: 'esnext',
    },
  },
})
