import { arrayType, booleanType, eventType, numberType, stringType } from '@v-c/utils'

const proLayoutEvents = {
  'onUpdate:openKeys': eventType(),
  'onUpdate:selectedKeys': eventType(),
  'onMenuSelect': eventType(),
}
export const proLayoutProps = {
  layout: stringType('mix'),
  logo: stringType(),
  title: stringType(),
  collapsedWidth: numberType(48),
  siderWidth: numberType(234),
  headerHeight: numberType(48),
  menuData: arrayType(),
  fixedHeader: booleanType(false),
  fixedSider: booleanType(true),
  splitMenus: booleanType(),
  collapsed: booleanType(false),
  leftCollapsed: booleanType(false),
  theme: stringType('light'),
  onCollapsed: eventType(),
  isMobile: booleanType(),
  contentWidth: stringType(),
  header: booleanType(true),
  footer: booleanType(true),
  menu: booleanType(true),
  menuHeader: booleanType(true),
  // 展开菜单
  openKeys: arrayType(),
  // 选中菜单
  selectedKeys: arrayType(),
  copyright: stringType(),
  ...proLayoutEvents,
}
