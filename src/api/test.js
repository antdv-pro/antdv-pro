export function test200() {
  return useGet('/')
}
export function test401() {
  return useGet('/401')
}
export function test500() {
  return useGet('/500')
}
export function testPut() {
  return usePut('/test')
}
export function testPost() {
  return usePost('/test')
}
export function testDelete() {
  return useDelete('/test')
}
