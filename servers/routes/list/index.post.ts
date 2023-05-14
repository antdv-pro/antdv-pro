export default eventHandler(async (event) => {
  const body = await readBody(event)

  const dataList = []
  for (let i = 0; i < 10; i++) {
    const item = {
      id: i + 1,
      title: `${body.title ?? '测试'}_${i}`,
      username: `${body.username ?? 'test'}_${i}`,
      password: `${body.username ?? 'test'}_pass_${i}`,
    }
    dataList.push(item)
  }

  return {
    code: 200,
    msg: '获取成功',
    data: dataList,
  }
})
