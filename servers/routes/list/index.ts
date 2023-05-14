export default eventHandler(() => {
  const dataList = []
  for (let i = 0; i < 10; i++) {
    const item = {
      id: i + 1,
      title: `测试_${i}`,
      username: `test_${i}`,
      password: `test_pass_${i}`,
    }
    dataList.push(item)
  }

  return {
    code: 200,
    msg: '获取成功',
    data: dataList,
  }
})
