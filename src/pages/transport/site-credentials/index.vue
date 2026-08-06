<script setup lang="ts">
import {
  AppstoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { createSiteDirectoryApi, deleteSiteDirectoryApi, getSiteDirectoryApi, updateSiteDirectoryApi } from '~/api/transport/site-directory'

type Category = '财务与税务' | '车辆与出行' | '协同办公' | '采购与服务'

interface CredentialRecord {
  id: number
  name: string
  domain: string
  url: string
  category: string
  username: string
  owner: string
  password: string
  updatedAt?: string
  favorite?: boolean
}

const message = useMessage()
const saving = ref(false)
const searchValue = ref('')
const activeCategory = ref<'全部' | Category>('全部')
const drawerOpen = ref(false)
const editorOpen = ref(false)
const editingId = ref<number>()
const selectedRecord = ref<CredentialRecord>()
const { hasAccess } = useAccess()
const canManage = computed(() => hasAccess('ADMIN'))
const categories: Array<'全部' | Category> = ['全部', '财务与税务', '车辆与出行', '协同办公', '采购与服务']

const records = ref<CredentialRecord[]>([])
const formData = reactive({ name: '', url: '', category: '协同办公' as Category, username: '', password: '', owner: '', favorite: false })

const filteredRecords = computed(() => {
  const keyword = searchValue.value.trim().toLowerCase()
  return records.value.filter((record) => {
    const matchesCategory = activeCategory.value === '全部' || record.category === activeCategory.value
    const matchesKeyword = !keyword || [record.name, record.domain, record.username, record.owner].some(value => value.toLowerCase().includes(keyword))
    return matchesCategory && matchesKeyword
  })
})

const recentRecords = computed(() => records.value.filter(record => record.favorite).slice(0, 3))

function categoryCount(category: '全部' | Category) {
  return category === '全部' ? records.value.length : records.value.filter(record => record.category === category).length
}

function getInitials(name: string) {
  return name.split(/\s+/).map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase()
}

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    message.success(`${label}已复制`)
  }
  catch {
    message.info(`${label}请手动复制`)
  }
}

function quickLogin(record: CredentialRecord) {
  selectedRecord.value = record
  drawerOpen.value = true
  window.open(record.url, '_blank', 'noopener,noreferrer')
  message.success(`已打开${record.name}，可在当前页面复制帐号和密码`)
}

function openDetail(record: CredentialRecord) {
  selectedRecord.value = record
  drawerOpen.value = true
}

async function loadRecords() {
  try {
    const response = await getSiteDirectoryApi()
    records.value = response.data || []
  }
  catch (error: any) {
    message.error(error?.message || '网站目录加载失败')
  }
}
function openEditor(record?: CredentialRecord) {
  editingId.value = record?.id
  Object.assign(formData, record ? { name: record.name, url: record.url, category: record.category as Category, username: record.username, password: record.password, owner: record.owner, favorite: Boolean(record.favorite) } : { name: '', url: '', category: '协同办公', username: '', password: '', owner: '', favorite: false })
  editorOpen.value = true
}
async function saveRecord() {
  if (saving.value)
    return
  const required = ['name', 'url', 'category', 'username', 'password', 'owner'] as const
  const missing = required.find(key => !String(formData[key] ?? '').trim())
  if (missing) {
    message.warning('请完整填写站点信息')
    return
  }
  saving.value = true
  try {
    const payload = { ...formData }
    if (editingId.value)
      await updateSiteDirectoryApi(editingId.value, payload)
    else await createSiteDirectoryApi(payload)
    editorOpen.value = false
    await loadRecords()
    message.success('网站目录已保存')
  }
  catch (error: any) { message.error(error?.message || '保存失败') }
  finally { saving.value = false }
}
async function removeRecord(record: CredentialRecord) {
  try {
    await deleteSiteDirectoryApi(record.id)
    drawerOpen.value = false
    await loadRecords()
    message.success('站点已删除')
  }
  catch (error: any) {
    message.error(error?.message || '删除失败')
  }
}
onMounted(loadRecords)
</script>

<template>
  <main class="credential-page">
    <section class="page-head">
      <div>
        <div class="eyebrow">
          基础数据 / 帐号网址
        </div>
        <h1>帐号网址</h1>
        <p>公司常用网站统一归档，所有人员均可查找网址、登录帐号和密码。</p>
      </div>
      <a-button v-if="canManage" type="primary" size="large" class="add-button" @click="openEditor()">
        <template #icon>
          <PlusOutlined />
        </template>新增站点
      </a-button>
    </section>

    <a-alert class="directory-banner" type="warning" show-icon :closable="false" message="共享账号目录：所有已登录人员均可查看、复制网址、帐号和密码。" />

    <section class="workspace">
      <aside class="side-panel">
        <div class="side-heading">
          分类
        </div>
        <button
          v-for="category in categories"
          :key="category"
          class="category-item"
          :class="{ active: activeCategory === category }"
          type="button"
          @click="activeCategory = category"
        >
          <span><AppstoreOutlined />{{ category }}</span>
          <b>{{ categoryCount(category) }}</b>
        </button>

        <div class="side-divider" />
        <div class="side-heading muted">
          最近访问
        </div>
        <button v-for="record in recentRecords" :key="record.id" class="recent-item" type="button" @click="openDetail(record)">
          <span class="site-mark tiny">{{ getInitials(record.name) }}</span>
          <span>{{ record.name }}</span>
        </button>
      </aside>

      <section class="content-panel">
        <div class="content-toolbar">
          <a-input v-model:value="searchValue" size="large" allow-clear placeholder="搜索站点、网址、账号或负责人">
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>
          <span class="result-count">{{ filteredRecords.length }} 个站点</span>
        </div>

        <div v-if="filteredRecords.length" class="credential-grid">
          <article v-for="record in filteredRecords" :key="record.id" class="credential-card" @click="openDetail(record)">
            <div class="card-topline">
              <span class="site-mark">{{ getInitials(record.name) }}</span>
              <a-tag class="category-tag">
                {{ record.category }}
              </a-tag>
            </div>
            <div class="site-title">
              <h2>{{ record.name }}</h2>
              <span>{{ record.domain }}</span>
            </div>
            <div class="credential-meta">
              <span><UserOutlined />{{ record.username }}</span>
              <span>保管部门：{{ record.owner }}</span>
            </div>
            <div class="card-footer">
              <span>更新于{{ record.updatedAt?.slice(0, 10) || '-' }}</span>
              <a-tooltip title="打开网站">
                <a-button type="text" class="icon-action" aria-label="快捷登录" @click.stop="quickLogin(record)">
                  <GlobalOutlined />
                </a-button>
              </a-tooltip>
            </div>
          </article>
        </div>
        <a-empty v-else description="没有匹配的站点" class="empty-state" />
      </section>
    </section>

    <a-drawer v-model:open="drawerOpen" :width="480" :body-style="{ padding: '0' }" class="credential-drawer">
      <template #title>
        <div v-if="selectedRecord" class="drawer-title">
          <span class="site-mark">{{ getInitials(selectedRecord.name) }}</span>
          <span><strong>{{ selectedRecord.name }}</strong><small>{{ selectedRecord.domain }}</small></span>
        </div>
      </template>
      <template v-if="selectedRecord">
        <div class="drawer-body">
          <div class="drawer-actions">
            <a-button type="primary" @click="quickLogin(selectedRecord)">
              <template #icon>
                <GlobalOutlined />
              </template>快捷登录
            </a-button>
            <a-button @click="copyValue(selectedRecord.username, '账号')">
              <template #icon>
                <CopyOutlined />
              </template>复制账号
            </a-button>
            <a-button @click="copyValue(selectedRecord.url, '网址')">
              <template #icon>
                <CopyOutlined />
              </template>复制网址
            </a-button>
            <a-button @click="copyValue(selectedRecord.password, '密码')">
              <template #icon>
                <CopyOutlined />
              </template>复制密码
            </a-button>
            <a-button v-if="canManage" @click="openEditor(selectedRecord)">
              <template #icon>
                <EditOutlined />
              </template>编辑
            </a-button>
            <a-popconfirm v-if="canManage" title="确认删除这个站点吗？" ok-text="删除" cancel-text="取消" @confirm="removeRecord(selectedRecord)">
              <a-button danger>
                <template #icon>
                  <DeleteOutlined />
                </template>删除
              </a-button>
            </a-popconfirm>
          </div>
          <dl class="credential-details">
            <div><dt>网址</dt><dd><a :href="selectedRecord.url" target="_blank" rel="noopener noreferrer">{{ selectedRecord.url }}</a></dd></div>
            <div><dt>账号</dt><dd>{{ selectedRecord.username }}</dd></div>
            <div><dt>密码</dt><dd><code class="password-value">{{ selectedRecord.password }}</code></dd></div>
            <div><dt>保管部门</dt><dd>{{ selectedRecord.owner }}</dd></div>
          </dl>
        </div>
        <footer class="drawer-note">
          已打开目标网站。帐号和密码可在当前详情中分别复制后登录。
        </footer>
      </template>
    </a-drawer>

    <a-modal v-model:open="editorOpen" :title="editingId ? '编辑站点' : '新增站点'" ok-text="保存" cancel-text="取消" :confirm-loading="saving" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" @ok="saveRecord">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="站点名称" required>
              <a-input v-model:value="formData.name" />
            </a-form-item>
          </a-col><a-col :span="12">
            <a-form-item label="分类" required>
              <a-select v-model:value="formData.category" :options="categories.slice(1).map(value => ({ value, label: value }))" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="网址" required>
          <a-input v-model:value="formData.url" placeholder="https://example.com" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="登录帐号" required>
              <a-input v-model:value="formData.username" />
            </a-form-item>
          </a-col><a-col :span="12">
            <a-form-item label="登录密码" required>
              <a-input-password v-model:value="formData.password" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="保管部门" required>
          <a-input v-model:value="formData.owner" />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="formData.favorite">
            加入最近访问
          </a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>
  </main>
</template>

<style scoped>
.credential-page {
  min-height: calc(100vh - 112px);
  padding: 28px 32px 40px;
  color: #1f2933;
  background: #f4f6f5;
}
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  max-width: 1440px;
  margin: 0 auto 22px;
}
.eyebrow {
  margin-bottom: 8px;
  color: #7b877f;
  font-size: 13px;
}
h1 {
  margin: 0;
  color: #1c2925;
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: 0;
}
.page-head p {
  margin: 9px 0 0;
  color: #6c7973;
  font-size: 14px;
}
.add-button {
  border-radius: 6px;
  background: #17694c;
  border-color: #17694c;
}
.directory-banner {
  max-width: 1440px;
  margin: 0 auto 18px;
  border: 1px solid #d6e6dd;
  border-radius: 6px;
  background: #f0f7f3;
  color: #476055;
}
.workspace {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  max-width: 1440px;
  min-height: 610px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #e5eae7;
  border-radius: 8px;
  box-shadow: 0 12px 32px rgb(24 52 41 / 6%);
  overflow: hidden;
}
.side-panel {
  padding: 22px 14px;
  border-right: 1px solid #e9eeeb;
  background: #fbfcfb;
}
.side-heading {
  padding: 0 10px 10px;
  color: #48554f;
  font-size: 13px;
  font-weight: 600;
}
.side-heading.muted {
  padding-top: 2px;
  color: #89948f;
  font-size: 12px;
}
.category-item,
.recent-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  background: transparent;
  color: #52605a;
  cursor: pointer;
  text-align: left;
}
.category-item {
  height: 38px;
  padding: 0 10px;
  border-radius: 5px;
  font-size: 13px;
}
.category-item span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.category-item b {
  color: #89948f;
  font-size: 12px;
  font-weight: 500;
}
.category-item:hover,
.category-item.active {
  color: #14583f;
  background: #e7f2ec;
}
.category-item.active b {
  color: #17694c;
}
.side-divider {
  height: 1px;
  margin: 19px 10px;
  background: #e8edeb;
}
.recent-item {
  gap: 9px;
  justify-content: flex-start;
  padding: 8px 10px;
  border-radius: 5px;
  font-size: 13px;
  overflow: hidden;
}
.recent-item:hover {
  background: #f0f4f2;
  color: #14583f;
}
.recent-item > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.content-panel {
  padding: 26px 28px;
}
.content-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}
.content-toolbar :deep(.ant-input-affix-wrapper) {
  max-width: 460px;
  border-radius: 6px;
  border-color: #dce4df;
  box-shadow: none;
}
.content-toolbar :deep(.ant-input-affix-wrapper-focused) {
  border-color: #24845f;
  box-shadow: 0 0 0 2px rgb(36 132 95 / 10%);
}
.result-count {
  margin-left: auto;
  color: #819088;
  font-size: 13px;
  white-space: nowrap;
}
.credential-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.credential-card {
  position: relative;
  min-height: 210px;
  padding: 18px;
  border: 1px solid #e6ebe8;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}
.credential-card:hover {
  border-color: #b7d8c6;
  box-shadow: 0 10px 22px rgb(34 77 56 / 9%);
  transform: translateY(-2px);
}
.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.site-mark {
  width: 38px;
  height: 38px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 7px;
  background: #dff0e6;
  color: #17694c;
  font-size: 12px;
  font-weight: 700;
}
.site-mark.tiny {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  font-size: 9px;
}
.category-tag {
  margin: 0;
  border: 0;
  border-radius: 4px;
  background: #f1f4f2;
  color: #617069;
  font-size: 11px;
}
.site-title {
  margin-top: 17px;
}
.site-title h2 {
  margin: 0 0 4px;
  color: #26342e;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0;
}
.site-title span {
  color: #89958f;
  font-size: 12px;
}
.credential-meta {
  display: grid;
  gap: 6px;
  margin-top: 17px;
  color: #64726b;
  font-size: 12px;
}
.credential-meta span {
  display: flex;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 15px;
  padding-top: 12px;
  border-top: 1px solid #edf0ee;
  color: #98a19d;
  font-size: 11px;
}
.icon-action {
  display: inline-grid;
  place-items: center;
  min-width: 30px;
  width: 30px;
  height: 30px;
  padding: 0;
  color: #4e6258;
  border-radius: 5px;
}
.icon-action:hover {
  color: #17694c;
  background: #eaf4ed;
}
.empty-state {
  padding: 110px 0;
}
.drawer-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.drawer-title strong,
.drawer-title small {
  display: block;
}
.drawer-title strong {
  color: #25342d;
  font-size: 15px;
}
.drawer-title small {
  margin-top: 2px;
  color: #84918a;
  font-size: 12px;
  font-weight: 400;
}
.drawer-body {
  padding: 24px;
}
.drawer-actions {
  display: flex;
  gap: 10px;
  padding-bottom: 22px;
  border-bottom: 1px solid #e9eeeb;
}
.drawer-actions :deep(.ant-btn-primary) {
  background: #17694c;
  border-color: #17694c;
}
.credential-details {
  margin: 0;
}
.credential-details > div {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid #edf0ee;
}
.credential-details dt {
  color: #89948f;
  font-size: 13px;
}
.credential-details dd {
  min-width: 0;
  margin: 0;
  color: #2e3a34;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.credential-details a {
  color: #17694c;
  text-decoration: none;
}
.password-value {
  color: #26342e;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: anywhere;
}
.drawer-note {
  margin: 0 24px 24px;
  padding: 12px 14px;
  border-radius: 6px;
  background: #f4f7f5;
  color: #65756c;
  font-size: 12px;
  line-height: 1.55;
}
@media (max-width: 1100px) {
  .credential-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 768px) {
  .credential-page {
    padding: 20px 16px 32px;
  }
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .workspace {
    display: block;
    min-height: 0;
  }
  .side-panel {
    display: flex;
    gap: 5px;
    padding: 12px;
    border-right: 0;
    border-bottom: 1px solid #e9eeeb;
    overflow-x: auto;
  }
  .side-heading,
  .side-divider,
  .recent-item {
    display: none;
  }
  .category-item {
    width: auto;
    flex: 0 0 auto;
    padding: 0 11px;
  }
  .content-panel {
    padding: 18px 14px;
  }
  .content-toolbar {
    margin-bottom: 16px;
  }
  .content-toolbar :deep(.ant-input-affix-wrapper) {
    max-width: none;
  }
  .credential-grid {
    grid-template-columns: 1fr;
  }
  .credential-card {
    min-height: 190px;
  }
}
</style>
