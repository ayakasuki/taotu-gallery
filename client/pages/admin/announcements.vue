<template>
  <div class="announcements-page">
    <header class="announcements-header">
      <div>
        <div class="breadcrumb"><span>站点设置</span><i>/</i><span>公告中心</span></div>
        <h1>公告中心</h1>
        <p>管理站内公告、草稿与置顶通知，发布后会出现在用户导航通知栏。</p>
      </div>
      <button type="button" class="primary-action" @click="openCreate">
        <img src="/icons/actions/add-64x64.png" alt="" />新增公告
      </button>
    </header>

    <section class="announcement-card">
      <div class="card-top">
        <div>
          <h2>公告管理面板</h2>
          <p>删除公告后，用户通知栏中的对应消息会同步消失。</p>
        </div>
        <div class="status-tabs">
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            type="button"
            :class="{ active: statusFilter === tab.value }"
            @click="switchStatus(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div class="announcement-table">
        <div class="table-head">
          <span>公告标题</span>
          <span>状态</span>
          <span>发布日期</span>
          <span>修改日期</span>
          <span>新建日期</span>
          <span>操作</span>
        </div>

        <div v-if="loading" class="empty-row">正在载入公告...</div>
        <div v-else-if="!announcements.length" class="empty-row">暂无公告，点击右上角新增公告。</div>

        <div v-for="item in announcements" v-else :key="item.id" class="table-row">
          <div class="title-cell">
            <strong>{{ item.title }}</strong>
            <small>{{ item.subtitle || '无副标题' }}</small>
          </div>
          <div>
            <span class="status-pill" :class="item.status">
              {{ item.status === 'published' ? '已发布' : '草稿' }}
            </span>
            <span v-if="item.is_pinned" class="pin-pill">置顶</span>
          </div>
          <span>{{ formatDate(item.published_at) }}</span>
          <span>{{ formatDate(item.updated_at) }}</span>
          <span>{{ formatDate(item.created_at) }}</span>
          <div class="row-actions">
            <button type="button" class="icon-action edit" title="编辑公告" @click="openEdit(item)">
              <img src="/icons/actions/edit-64x64.png" alt="" />
            </button>
            <button
              v-if="item.status === 'draft'"
              type="button"
              class="text-action publish"
              @click="publishDraft(item)"
            >
              发布
            </button>
            <button type="button" class="icon-action delete" title="删除公告" @click="deleteAnnouncement(item)">
              <img src="/icons/actions/trash-64x64.png" alt="" />
            </button>
          </div>
        </div>
      </div>

      <footer class="pagination-row">
        <span>共 {{ total }} 条公告</span>
        <div class="pager">
          <button type="button" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button type="button" :disabled="page >= totalPages" @click="goPage(page + 1)">下一页</button>
        </div>
      </footer>
    </section>

    <div v-if="editorOpen" class="editor-overlay" @click.self="closeEditor">
      <section class="editor-card">
        <header>
          <div>
            <h2>{{ editingId ? '编辑公告' : '新增公告' }}</h2>
            <p>公告发布后会进入用户通知栏，草稿不会被用户看到。</p>
          </div>
          <button type="button" class="close-btn" @click="closeEditor">×</button>
        </header>

        <label class="form-field">
          <span>公告标题 *</span>
          <input v-model.trim="form.title" maxlength="200" placeholder="请输入公告标题" />
        </label>

        <label class="form-field">
          <span>副标题</span>
          <input v-model.trim="form.subtitle" maxlength="300" placeholder="用于公告详情页的补充说明" />
        </label>

        <label class="soft-check">
          <input v-model="form.is_pinned" type="checkbox" />
          <i></i>
          <span>置顶公告，用户通知栏会优先展示最新置顶公告</span>
        </label>

        <label class="form-field">
          <span>正文 *</span>
          <textarea
            v-model="form.content"
            rows="9"
            spellcheck="false"
            placeholder="请输入公告正文，支持空格、缩进、符号和换行段落"
          ></textarea>
        </label>

        <footer class="editor-actions">
          <button type="button" class="ghost-btn" @click="closeEditor">取消</button>
          <button type="button" class="draft-btn" :disabled="saving" @click="saveAnnouncement('draft')">
            <img src="/icons/actions/save-64x64.png" alt="" />存为草稿
          </button>
          <button type="button" class="publish-btn" :disabled="saving" @click="saveAnnouncement('published')">
            <img src="/icons/actions/confirm-64x64.png" alt="" />发布
          </button>
        </footer>
      </section>
    </div>

    <ConfirmDeleteDialog
      :show="deleteDialog.show"
      title="确认删除公告"
      :message="deleteDialog.message"
      :effects="deleteDialog.effects"
      avatar-text="告"
      :loading="deleteDialog.loading"
      @confirm="confirmDeleteAnnouncement"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const { showAdminToast } = useAdminToast()

const statusTabs = [
  { label: '全部公告', value: 'all' },
  { label: '已发布', value: 'published' },
  { label: '草稿箱', value: 'draft' }
]

const announcements = ref([])
const statusFilter = ref('all')
const loading = ref(false)
const saving = ref(false)
const page = ref(1)
const pageSize = 10
const total = ref(0)
const editorOpen = ref(false)
const editingId = ref(null)
const deleteDialog = reactive({ show: false, payload: null, message: '', effects: [], loading: false })
const form = reactive({
  title: '',
  subtitle: '',
  content: '',
  is_pinned: false
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

onMounted(() => {
  loadAnnouncements()
})

async function loadAnnouncements() {
  loading.value = true
  try {
    const data = await api.get('/api/admin/announcements', {
      status: statusFilter.value,
      page: page.value,
      pageSize
    })
    announcements.value = data.announcements || []
    total.value = Number(data.total || 0)
    if (page.value > totalPages.value) {
      page.value = totalPages.value
      await loadAnnouncements()
    }
  } catch (err) {
    showAdminToast('公告加载失败: ' + (err.data?.error || err.message), 'error')
  } finally {
    loading.value = false
  }
}

function switchStatus(status) {
  statusFilter.value = status
  page.value = 1
  loadAnnouncements()
}

function resetForm() {
  editingId.value = null
  form.title = ''
  form.subtitle = ''
  form.content = ''
  form.is_pinned = false
}

function openCreate() {
  resetForm()
  editorOpen.value = true
}

function openEdit(item) {
  editingId.value = item.id
  form.title = item.title || ''
  form.subtitle = item.subtitle || ''
  form.content = item.content || ''
  form.is_pinned = !!item.is_pinned
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
}

async function saveAnnouncement(status) {
  if (!form.title.trim() || !form.content.trim()) {
    showAdminToast('公告标题和正文不能为空', 'error')
    return
  }
  saving.value = true
  const payload = {
    title: form.title,
    subtitle: form.subtitle,
    content: form.content,
    is_pinned: form.is_pinned,
    status
  }
  try {
    const data = editingId.value
      ? await api.put(`/api/admin/announcements/${editingId.value}`, payload)
      : await api.post('/api/admin/announcements', payload)
    showAdminToast(data.message || (status === 'published' ? '公告已发布' : '公告已存为草稿'), 'success')
    editorOpen.value = false
    await loadAnnouncements()
  } catch (err) {
    showAdminToast('保存失败: ' + (err.data?.error || err.message), 'error')
  } finally {
    saving.value = false
  }
}

async function publishDraft(item) {
  editingId.value = item.id
  form.title = item.title || ''
  form.subtitle = item.subtitle || ''
  form.content = item.content || ''
  form.is_pinned = !!item.is_pinned
  await saveAnnouncement('published')
}

async function deleteAnnouncement(item) {
  deleteDialog.show = true
  deleteDialog.payload = item
  deleteDialog.message = `删除公告「${item.title}」？`
  deleteDialog.effects = ['用户通知栏会同步移除', '已读状态记录会随公告清理']
}

function closeDeleteDialog() {
  if (deleteDialog.loading) return
  deleteDialog.show = false
  deleteDialog.payload = null
  deleteDialog.effects = []
}

async function confirmDeleteAnnouncement() {
  if (!deleteDialog.payload || deleteDialog.loading) return
  deleteDialog.loading = true
  const item = deleteDialog.payload
  try {
    const data = await api.del(`/api/admin/announcements/${item.id}`)
    showAdminToast(data.message || '公告已删除', 'success')
    await loadAnnouncements()
    deleteDialog.loading = false
    closeDeleteDialog()
  } catch (err) {
    showAdminToast('删除失败: ' + (err.data?.error || err.message), 'error')
  } finally {
    deleteDialog.loading = false
  }
}

function goPage(nextPage) {
  page.value = Math.min(totalPages.value, Math.max(1, nextPage))
  loadAnnouncements()
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
</script>

<style scoped>
.announcements-page {
  min-height: calc(100vh - 108px);
  padding: 18px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 8% 0%, rgba(248, 95, 154, 0.12), transparent 30%),
    radial-gradient(circle at 92% 8%, rgba(120, 205, 248, 0.14), transparent 34%),
    rgba(255, 255, 255, 0.34);
}

.announcements-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22px;
  margin-bottom: 18px;
}

.breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #a28ca4;
  font-size: 13px;
  font-weight: 850;
}

.breadcrumb i {
  color: #d2c1d2;
  font-style: normal;
}

.announcements-header h1 {
  margin: 7px 0 6px;
  color: var(--taotu-text-strong);
  font-size: 30px;
  font-weight: 950;
  letter-spacing: 0;
}

.announcements-header p,
.card-top p {
  margin: 0;
  color: var(--taotu-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.primary-action,
.publish-btn,
.draft-btn,
.ghost-btn,
.text-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.primary-action,
.publish-btn {
  min-width: 126px;
  border: none;
  background: linear-gradient(135deg, var(--taotu-pink), #ff8ab8);
  color: white;
  box-shadow: 0 12px 24px rgba(248, 95, 154, 0.22);
}

.primary-action img,
.publish-btn img,
.draft-btn img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.primary-action:hover,
.publish-btn:hover,
.draft-btn:hover,
.ghost-btn:hover,
.text-action:hover,
.icon-action:hover {
  transform: scale(0.985);
}

.announcement-card {
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 18px 46px rgba(96, 72, 116, 0.12);
  backdrop-filter: blur(24px);
  overflow: hidden;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 22px 14px;
}

.card-top h2 {
  margin: 0 0 5px;
  color: var(--taotu-text-strong);
  font-size: 20px;
  font-weight: 950;
}

.status-tabs {
  display: inline-flex;
  padding: 4px;
  border: 1px solid rgba(238, 210, 226, 0.74);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
}

.status-tabs button {
  min-width: 82px;
  min-height: 32px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--taotu-text-muted);
  font-weight: 900;
  cursor: pointer;
}

.status-tabs button.active {
  background: rgba(255, 240, 246, 0.98);
  color: var(--taotu-pink);
}

.announcement-table {
  margin: 0 18px;
  border: 1px solid rgba(238, 210, 226, 0.58);
  border-radius: 16px;
  overflow: hidden;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.55fr) 150px 150px 150px 150px 138px;
  align-items: center;
  gap: 12px;
}

.table-head {
  min-height: 46px;
  padding: 0 16px;
  background: rgba(248, 250, 255, 0.82);
  color: #8c9ab6;
  font-size: 13px;
  font-weight: 950;
}

.table-row {
  min-height: 72px;
  padding: 12px 16px;
  border-top: 1px solid rgba(238, 210, 226, 0.46);
  color: #59657a;
  font-size: 13px;
}

.title-cell {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.title-cell strong {
  overflow: hidden;
  color: var(--taotu-text-strong);
  font-size: 15px;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-cell small {
  overflow: hidden;
  color: var(--taotu-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill,
.pin-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.status-pill.published {
  background: rgba(218, 246, 230, 0.94);
  color: #22a46a;
}

.status-pill.draft {
  background: rgba(241, 236, 255, 0.96);
  color: var(--taotu-purple);
}

.pin-pill {
  margin-left: 6px;
  background: rgba(255, 240, 246, 0.96);
  color: var(--taotu-pink);
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.icon-action {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(238, 210, 226, 0.68);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.76);
  cursor: pointer;
}

.icon-action img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.icon-action.delete {
  background: rgba(255, 240, 246, 0.86);
  border-color: rgba(248, 95, 154, 0.18);
}

.text-action.publish {
  min-width: 52px;
  min-height: 34px;
  border: 1px solid rgba(156, 106, 222, 0.18);
  background: rgba(241, 236, 255, 0.92);
  color: var(--taotu-purple);
}

.empty-row {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid rgba(238, 210, 226, 0.46);
  color: var(--taotu-text-muted);
  font-weight: 850;
}

.pagination-row {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 22px;
  color: var(--taotu-text-muted);
  font-size: 13px;
  font-weight: 850;
}

.pager {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.pager button {
  min-width: 72px;
  min-height: 32px;
  border: 1px solid rgba(238, 210, 226, 0.68);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--taotu-text);
  font-weight: 850;
  cursor: pointer;
}

.pager button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(64, 50, 76, 0.22);
  backdrop-filter: blur(10px);
}

.editor-card {
  width: min(720px, calc(100vw - 40px));
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 28px 70px rgba(74, 53, 96, 0.22);
}

.editor-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.editor-card h2 {
  margin: 0 0 6px;
  color: var(--taotu-text-strong);
  font-size: 22px;
  font-weight: 950;
}

.editor-card p {
  margin: 0;
  color: var(--taotu-text-muted);
  font-size: 13px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 240, 246, 0.92);
  color: var(--taotu-pink);
  font-size: 22px;
  cursor: pointer;
}

.form-field {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.form-field span,
.soft-check span {
  color: var(--taotu-text-strong);
  font-size: 13px;
  font-weight: 900;
}

.form-field input,
.form-field textarea {
  width: 100%;
  border: 1px solid rgba(218, 226, 240, 0.9);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--taotu-text);
  font-size: 14px;
  outline: none;
}

.form-field input {
  height: 42px;
  padding: 0 13px;
}

.form-field textarea {
  resize: vertical;
  min-height: 180px;
  padding: 12px 13px;
  font-family: inherit;
  line-height: 1.7;
  white-space: pre-wrap;
  tab-size: 4;
}

.form-field input:focus,
.form-field textarea:focus {
  border-color: rgba(248, 95, 154, 0.42);
  box-shadow: 0 0 0 3px rgba(248, 95, 154, 0.1);
}

.soft-check {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 16px;
  cursor: pointer;
}

.soft-check input {
  position: absolute;
  opacity: 0;
}

.soft-check i {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(218, 226, 240, 0.92);
  border-radius: 6px;
  background: white;
}

.soft-check input:checked + i {
  border-color: transparent;
  background: var(--taotu-pink);
}

.soft-check input:checked + i::after {
  content: "";
  width: 8px;
  height: 4px;
  border-left: 2px solid white;
  border-bottom: 2px solid white;
  transform: rotate(-45deg) translateY(-1px);
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

.ghost-btn {
  min-width: 86px;
  border: 1px solid rgba(218, 226, 240, 0.9);
  background: rgba(255, 255, 255, 0.78);
  color: var(--taotu-text);
}

.draft-btn {
  min-width: 112px;
  border: 1px solid rgba(248, 95, 154, 0.22);
  background: rgba(255, 240, 246, 0.92);
  color: var(--taotu-pink);
}

@media (max-width: 1180px) {
  .table-head,
  .table-row {
    grid-template-columns: minmax(220px, 1.4fr) 130px 138px 138px 138px 130px;
  }
}
</style>
