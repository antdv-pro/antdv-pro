import dayjs from 'dayjs'
import { cloneDeep } from 'lodash-es'

export default eventHandler(async (_event) => {
  const dataList = [
    {
      title: 'Aipay',
      link: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
      percent: 57,
      content: '一生那么短，遗忘又那么漫长',
    },
    {
      title: 'Ant Design Vue',
      link: 'https://www.antdv.com/assets/logo.1ef800a8.svg',
      percent: 60,
      status: 'active',
      content: '只有在梦想中，人才能真正自由',
    },
    {
      title: 'Vue',
      link: 'https://gw.alipayobjects.com/zos/rmsportal/ComBAopevLwENQdKWiIn.png',
      percent: 70,
      status: 'exception',
      content: '生命就像一盒巧克力，结果往往出人意料',
    },
    {
      title: 'Vite',
      link: 'https://cn.vitejs.dev/logo.svg',
      percent: 100,
      status: 'active',
      content: '有时，你必须进入别人的世界去发现自己的世界缺少什么',
    },
    {
      title: 'React',
      link: 'https://gw.alipayobjects.com/zos/rmsportal/kZzEzemZyKLKFsojXItE.png',
      percent: 50,
      status: 'exception',
      content: '希望是件美丽的东西，也许是最好的东西',
    },
    {
      title: 'Antdv Pro',
      link: '/logo.svg',
      percent: 80,
      status: 'active',
      content: '人并非生来就伟大，而是越活越伟大',
    },
    {
      title: 'Webpack',
      link: 'https://gw.alipayobjects.com/zos/rmsportal/nxkuOJlFJuAUhzlMTCEe.png',
      percent: 58,
      content: '不管何时何地，做你想做的事永远都不嫌晚',
    },
    {
      title: 'Angular',
      link: 'https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png',
      percent: 70,
      status: 'active',
      content: '你要一直不停地往前走，不然你不会知道生活还会给你什么',
    },
  ]

  const data = []

  // 数据复制
  for (let i = 0; i < 1000; i++) {
    const arr = cloneDeep(dataList)
    data.push(...arr)
  }

  // 配置任务时间
  for (let i = 0; i < data.length; i++)
    data[i].start = dayjs().subtract(i, 'hour').format('YYYY-MM-DD HH:mm')

  return {
    code: 200,
    msg: '获取成功',
    data,
  }
})
