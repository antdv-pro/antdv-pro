export default eventHandler(async (event) => {
  console.log(event)
  // todo
  return {
    code: 200,
    msg: '编辑成功',
  }
})
