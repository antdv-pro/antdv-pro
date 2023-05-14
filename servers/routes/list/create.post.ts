export default eventHandler(async (event) => {
  const body = await readBody(event)
  console.log(body)
  return {
    code: 200,
    msg: '创建成功',
  }
})
