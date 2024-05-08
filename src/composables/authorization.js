export const STORAGE_AUTHORIZE_KEY = 'Authorization'
export const useAuthorization = createGlobalState(() => useStorage(STORAGE_AUTHORIZE_KEY, null))
