import type { ComponentResolver } from 'unplugin-vue-components'
import { AllComponents } from './all-components'

export default function (): ComponentResolver {
  return {
    type: 'component',
    resolve: (name) => {
      const antName = name.replace(/^A/, '')
      if (AllComponents.includes(antName)) {
        return {
          name: antName,
          as: name,
          from: 'ant-design-vue/es',
        }
      }
    },
  }
}
