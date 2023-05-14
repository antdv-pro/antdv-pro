export default eventHandler((event) => {
  const id = event.context.params.id
  if (typeof id !== 'number') {
    setResponseStatus(event, 403)
    return {
      code: 403,
      msg: '删除失败',
    }
  }
  return {
    code: 200,
    msg: '删除成功',
  }
})
