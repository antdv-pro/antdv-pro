export default eventHandler((event) => {
  setResponseStatus(event, 401)
  return {
    code: 401,
    msg: '请先登录',
  }
})
