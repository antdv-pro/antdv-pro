export default eventHandler((event) => {
  setResponseStatus(event, 500)
  return {
    code: 500,
    msg: '服务器错误',
  }
})
