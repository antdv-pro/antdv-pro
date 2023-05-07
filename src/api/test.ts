export const test200 = () => {
  return useGet('/')
}

export const test401 = () => {
  return useGet('/401')
}

export const test500 = () => {
  return useGet('/500')
}

export const testPut = () => {
  return usePut('/test')
}

export const testPost = () => {
  return usePost('/test')
}

export const testDelete = () => {
  return useDelete('/test')
}
