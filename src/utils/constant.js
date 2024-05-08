export const AccessEnum = /* @__PURE__ */ ((AccessEnum2) => {
  AccessEnum2.ADMIN = 'ADMIN'
  AccessEnum2.USER = 'USER'
  return AccessEnum2
})({})
export const DynamicLoadEnum = /* @__PURE__ */ ((DynamicLoadEnum2) => {
  DynamicLoadEnum2.FRONTEND = 'FRONTEND'
  DynamicLoadEnum2.BACKEND = 'BACKEND'
  return DynamicLoadEnum2
})({})
export const STATUS = /* @__PURE__ */ ((STATUS2) => {
  STATUS2.OFF = '0'
  STATUS2.RUNNING = '1'
  STATUS2.ONLINE = '2'
  STATUS2.ERROR = '3'
  return STATUS2
})({})
export const DYNAMIC_LOAD_WAY = import.meta.env.VITE_APP_LOAD_ROUTE_WAY ?? 'BACKEND' /* BACKEND */
