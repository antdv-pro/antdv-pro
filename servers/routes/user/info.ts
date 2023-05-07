export default eventHandler(() => {
  return {
    code: 200,
    msg: '获取成功',
    data: {
      id: 1,
      username: 'admin',
      nickname: '超级管理员',
    },
  }
})
