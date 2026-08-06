export interface SiteDirectoryRecord {
  id: number
  name: string
  url: string
  domain: string
  category: string
  username: string
  password: string
  owner: string
  favorite?: boolean
  updatedAt?: string
}

type SiteDirectoryPayload = Omit<SiteDirectoryRecord, 'id' | 'domain' | 'updatedAt'>

export function getSiteDirectoryApi() {
  return useGet<SiteDirectoryRecord[]>('/transport/site-directory')
}

export function createSiteDirectoryApi(data: SiteDirectoryPayload) {
  return usePost<SiteDirectoryRecord, SiteDirectoryPayload>('/transport/site-directory', data)
}

export function updateSiteDirectoryApi(id: number, data: SiteDirectoryPayload) {
  return usePut<SiteDirectoryRecord, SiteDirectoryPayload>(`/transport/site-directory/${id}`, data)
}

export function deleteSiteDirectoryApi(id: number) {
  return useDelete(`/transport/site-directory/${id}`)
}
