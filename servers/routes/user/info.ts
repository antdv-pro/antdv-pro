import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  const token = event.req.headers.get('Authorization')
  // eslint-disable-next-line node/prefer-global/buffer
  const username = Buffer.from(token, 'base64').toString('utf-8')
  if (!token) {
    return {
      code: 401,
      msg: '登录失效',
    }
  }
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
