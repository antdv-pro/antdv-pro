export default eventHandler((event) => {
  setResponseStatus(event, 403)
  return {
    code: 403,
    msg: '请先登录',
  }
})
