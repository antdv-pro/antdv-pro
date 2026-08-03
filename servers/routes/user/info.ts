import { defineEventHandler } from 'h3'
import { systemStore } from '../../utils/system-store'
import { repairMojibake } from '../../utils/text-repair'

export default defineEventHandler((event) => {
  const token = event.req.headers.get('Authorization')
  if (!token) {
    return {
      code: 401,
      msg: '登录失效',
    }
  }
  const user = systemStore.getUserByToken(token)
  if (!user || user.status === 'disabled') {
    event.res.status = 401
    return {
      code: 401,
      msg: '登录失效',
    }
  }
  return {
    code: 200,
    msg: '获取成功',
    data: {
      id: user.id,
      username: user.username,
      nickname: repairMojibake(user.nickname),
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
      roles: user.roles,
      deptId: user.deptId,
      deptName: repairMojibake(user.deptName),
      postId: user.postId,
      postName: repairMojibake(user.postName),
    },
  }
})
