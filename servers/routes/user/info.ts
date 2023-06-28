export default eventHandler((event) => {
  const token = getHeader(event, 'Authorization')
  const username = Buffer.from(token, 'base64').toString('utf-8')
  return {
    code: 200,
    msg: '获取成功',
    data: {
      id: 1,
      username,
      nickname: username === 'admin' ? '超级管理员' : '普通用户',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
      roles: username === 'admin' ? ['ADMIN'] : ['USER'],
    },
  }
})
