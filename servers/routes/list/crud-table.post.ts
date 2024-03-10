export default eventHandler(async (_event) => {
  const body = await readBody(_event)

  const dataList = [
    {
      id: 1,
      name: '第一个任务',
      value: '2000',
      remark: '一生那么短，遗忘又那么漫长',
    },
    {
      id: 2,
      name: 'Ant Design Vue',
      value: '200',
      remark: '有时，你必须进入别人的世界去发现自己的世界缺少什么',
    },
    {
      id: 3,
      name: 'Vue',
      value: '2010',
      remark: '一生那么短，遗忘又那么漫长',
    },
    {
      id: 4,
      name: 'Vite',
      value: '20300',
      remark: '希望是件美丽的东西，也许是最好的东西',
    },
    {
      id: 5,
      name: 'React',
      value: '2000',
      remark: '人并非生来就伟大，而是越活越伟大',
    },
    {
      id: 6,
      name: 'Antdv Pro',
      value: '2000',
      remark: '不管何时何地，做你想做的事永远都不嫌晚',
    },
    {
      id: 7,
      name: 'Webpack',
      value: '2000',
      remark: '你要一直不停地往前走，不然你不会知道生活还会给你什么',
    },
  ]
  const data = dataList.filter((i) => {
    if (body.name)
      return body.name === i.name
    else return true
  })
  return {
    code: 200,
    msg: '获取成功',
    data: {
      records: data,
      total: data.length,
    },
  }
})
