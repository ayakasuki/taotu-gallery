<template>
  <div class="admin-tags">
    <h1 class="page-title">标签设置</h1>

    <div class="tabs">
      <button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">{{ tab.label }}</button>
    </div>

    <!-- 标签管理 -->
    <div v-if="activeTab === 'manage'" class="tab-content fluent-card">
      <div class="section-header">
        <h3>标签列表</h3>
        <button class="fluent-btn fluent-btn-primary" @click="openAddTag">添加标签</button>
      </div>

      <div class="tag-table">
        <div class="table-header">
          <span>ID</span><span>名称</span><span>显示名</span><span>公共</span><span>可组合</span><span>操作</span>
        </div>
        <div v-for="tag in allTags" :key="tag.id" class="table-row">
          <span>{{ tag.id }}</span>
          <span>{{ tag.name }}</span>
          <span>{{ tag.display_name }}</span>
          <span>
            <input type="checkbox" :checked="isTagPublic(tag)" @change="toggleTagPublic(tag, $event)" />
          </span>
          <span>{{ tag.combinable ? '可组合' : '互斥' }}</span>
          <span class="row-actions">
            <button class="fluent-btn fluent-btn-secondary" @click="openEditTag(tag)">编辑</button>
            <button class="fluent-btn fluent-btn-secondary" @click="deleteTag(tag)">删除</button>
          </span>
        </div>
        <div v-if="allTags.length === 0" class="empty-msg">暂无标签</div>
      </div>

      <!-- 添加/编辑标签弹窗 -->
      <div v-if="showTagModal" class="modal-overlay" @click.self="closeTagModal">
        <div class="modal fluent-card">
          <h3>{{ editingTag ? '编辑标签' : '添加标签' }}</h3>
          <div class="form-group">
            <label>名称（英文标识）</label>
            <input v-model="tagForm.name" class="fluent-input" :disabled="!!editingTag" />
          </div>
          <div class="form-group">
            <label>显示名称</label>
            <input v-model="tagForm.display_name" class="fluent-input" />
          </div>
          <div class="form-group">
            <label><input type="checkbox" v-model="tagForm.combinable" /> 可组合标签（取消勾选则为互斥标签）</label>
          </div>
          <div class="form-group" v-if="!tagForm.combinable">
            <label>互斥标签 ID（选填）</label>
            <input v-model.number="tagForm.mutually_exclusive_with" type="number" class="fluent-input" placeholder="与之互斥的标签 ID" />
          </div>
          <div class="modal-actions">
            <button class="fluent-btn fluent-btn-primary" @click="saveTag">保存</button>
            <button class="fluent-btn fluent-btn-secondary" @click="closeTagModal">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 人工标签 -->
    <div v-if="activeTab === 'manual'" class="tab-content fluent-card">
      <h3>人工标签</h3>
      <p class="desc">选择图片后，为它们批量打标签</p>

      <!-- 筛选工具栏 -->
      <div class="toolbar">
        <select v-model="manualSort" class="fluent-select" @change="loadManualImages">
          <option value="created_at">最新</option>
          <option value="view_count">最热门</option>
        </select>
        <select v-model="manualAlbum" class="fluent-select" @change="loadManualImages">
          <option :value="null">全部相册</option>
          <option v-for="a in albums" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <span class="selected-count">已选 {{ manualSelected.length }} 张</span>
      </div>

      <!-- 图片列表 -->
      <div class="image-grid">
        <div v-for="img in manualImages" :key="img.id" class="image-card" :class="{ selected: manualSelected.includes(img.id) }" @click="toggleManualSelect(img.id)">
          <div class="card-thumb">
            <img :src="getThumbUrl(img)" loading="lazy" />
            <div class="check-mark" v-if="manualSelected.includes(img.id)">✓</div>
          </div>
          <p class="card-name">{{ img.filename }}</p>
        </div>
      </div>
      <div v-if="manualImages.length === 0" class="empty-msg">暂无图片</div>

      <!-- 翻页 -->
      <div class="pagination" v-if="manualTotal > 10">
        <button class="fluent-btn fluent-btn-secondary" :disabled="manualPage <= 1" @click="loadManualImages(manualPage - 1)">上一页</button>
        <span>第 {{ manualPage }} 页 / 共 {{ Math.ceil(manualTotal / 10) }} 页</span>
        <button class="fluent-btn fluent-btn-secondary" :disabled="manualPage >= Math.ceil(manualTotal / 10)" @click="loadManualImages(manualPage + 1)">下一页</button>
      </div>

      <!-- 选标签 + 执行 -->
      <div class="manual-action" v-if="manualSelected.length > 0">
        <div class="form-group">
          <label>选择要应用的标签</label>
          <TagSelector :tags="tags" :selectedTagIds="manualTagIds" @update:selectedTagIds="manualTagIds = $event" />
        </div>
        <div class="form-group">
          <label><input type="checkbox" v-model="manualOverwrite" /> 覆盖式标签（删除旧标签后写入）</label>
        </div>
        <button class="fluent-btn fluent-btn-primary" @click="runManualTag" :disabled="manualLoading">
          {{ manualLoading ? '执行中...' : `立即标签 ${manualSelected.length} 张图片` }}
        </button>
        <p v-if="manualResult" class="result-msg">{{ manualResult }}</p>
      </div>
    </div>

    <!-- 通用配置 -->
    <div v-if="activeTab === 'config'" class="tab-content fluent-card">
      <h3>标签通用配置</h3>
      <div class="form-group">
        <label>延迟执行时间（分钟）</label>
        <input v-model.number="tagConfig.delayMinutes" type="number" class="fluent-input" />
      </div>
      <div class="form-group">
        <label>差异阈值（0-1，超过则全部重标签）</label>
        <input v-model.number="tagConfig.diffThreshold" type="number" step="0.1" min="0" max="1" class="fluent-input" />
      </div>
      <button class="fluent-btn fluent-btn-primary" @click="saveTagConfig">保存配置</button>
    </div>

    <!-- 标签分组管理 -->
    <div class="section-card fluent-card" style="margin-top: var(--space-xl);">
      <div class="section-header">
        <h3>标签分组管理</h3>
        <button class="fluent-btn fluent-btn-primary" @click="showAddGroup = true">新建分组</button>
      </div>
      <p class="desc">标签分组用于前端筛选导航，支持二级子分组。不影响标签本身功能。</p>

      <div v-if="tagGroups.length > 0" class="group-list">
        <div v-for="group in tagGroups" :key="group.id" class="group-item">
          <div class="group-header">
            <span class="group-name">{{ group.name }}</span>
            <span class="group-meta">{{ (group.subgroups || []).length }} 个子分组 · {{ (group.tagIds || []).length }} 个标签</span>
            <div class="group-actions">
              <button class="fluent-btn fluent-btn-secondary" @click="openEditGroup(group)">编辑</button>
              <button class="fluent-btn fluent-btn-secondary" @click="openAddSubgroup(group)">添加子分组</button>
              <button class="fluent-btn fluent-btn-secondary delete-btn" @click="deleteGroup(group)">删除</button>
            </div>
          </div>
          <!-- 子分组列表 -->
          <div v-if="group.subgroups && group.subgroups.length > 0" class="subgroup-list">
            <div v-for="sg in group.subgroups" :key="sg.id" class="subgroup-item">
              <span class="sg-name">{{ sg.name }}</span>
              <span class="sg-count">{{ (sg.tagIds || []).length }} 个标签</span>
              <button class="fluent-btn fluent-btn-secondary btn-sm" @click="openEditSubgroup(group, sg)">编辑标签</button>
              <button class="fluent-btn fluent-btn-secondary btn-sm delete-btn" @click="deleteSubgroup(group, sg)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-msg">暂无分组</div>
    </div>

    <!-- 新建分组弹窗 -->
    <div v-if="showAddGroup" class="modal-overlay" @click.self="showAddGroup = false">
      <div class="modal fluent-card">
        <h3>{{ editingGroup ? '编辑分组' : '新建分组' }}</h3>
        <div class="form-group">
          <label>分组名称</label>
          <input v-model="groupForm.name" class="fluent-input" placeholder="例如：游戏、风格" />
        </div>
        <div class="form-group" v-if="editingGroup">
          <label>分组内标签（多选）</label>
          <div class="tag-picker">
            <span v-for="tag in allTagsList" :key="tag.id" class="tag-chip"
              :class="{ selected: groupForm.tagIds.includes(tag.id) }"
              @click="toggleGroupTag(tag.id)">{{ tag.display_name || tag.name }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="saveGroup">保存</button>
          <button class="fluent-btn fluent-btn-secondary" @click="showAddGroup = false; editingGroup = null">取消</button>
        </div>
      </div>
    </div>

    <!-- 编辑子分组标签弹窗 -->
    <div v-if="editingSubgroup" class="modal-overlay" @click.self="editingSubgroup = null">
      <div class="modal fluent-card">
        <h3>编辑子分组: {{ editingSubgroup.name }}</h3>
        <div class="form-group">
          <label>子分组标签（多选）</label>
          <div class="tag-picker">
            <span v-for="tag in allTagsList" :key="tag.id" class="tag-chip"
              :class="{ selected: subgroupForm.tagIds.includes(tag.id) }"
              @click="toggleSubgroupTag(tag.id)">{{ tag.display_name || tag.name }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="saveSubgroup">保存</button>
          <button class="fluent-btn fluent-btn-secondary" @click="editingSubgroup = null">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'

definePageMeta({ layout: 'admin' })

const { tags, fetchTags: fetchPublicTags, allTags: publicAllTags } = useTags()
const api = useApi()
const config = useRuntimeConfig()

// 管理员专用：获取所有标签（含私有）
const allTags = ref([])
const fetchAdminTags = async () => {
  try {
    const data = await api.get('/api/admin/tags')
    tags.value = data
    allTags.value = [...(data.combinable || []), ...(data.nonCombinable || [])]
  } catch (err) {
    console.error('获取标签失败:', err)
  }
}

// 覆盖 fetchTags 使用管理接口
const fetchTags = fetchAdminTags

const activeTab = ref('manage')
const tabs = [
  { key: 'manage', label: '标签管理' },
  { key: 'manual', label: '人工标签' },
  { key: 'config', label: '通用配置' }
]

// 标签管理
const showTagModal = ref(false)
const editingTag = ref(null)
const tagForm = reactive({ name: '', display_name: '', combinable: true, mutually_exclusive_with: null })

const openAddTag = () => {
  editingTag.value = null
  tagForm.name = ''; tagForm.display_name = ''; tagForm.combinable = true; tagForm.mutually_exclusive_with = null
  showTagModal.value = true
}

const openEditTag = (tag) => {
  editingTag.value = tag
  tagForm.name = tag.name
  tagForm.display_name = tag.display_name || ''
  tagForm.combinable = tag.combinable !== false
  tagForm.mutually_exclusive_with = tag.mutually_exclusive_with || null
  showTagModal.value = true
}

const closeTagModal = () => { showTagModal.value = false; editingTag.value = null }

const isTagPublic = (tag) => {
  return !!tag.is_public
}

const saveTag = async () => {
  try {
    const currentTags = JSON.parse(JSON.stringify(tags.value))
    if (editingTag.value) {
      // 编辑：在对应数组中找到并更新
      const list = currentTags.combinable || []
      const ncList = currentTags.nonCombinable || []
      let found = list.find(t => t.id === editingTag.value.id)
      if (found) {
        found.display_name = tagForm.display_name
        found.combinable = tagForm.combinable
        found.mutually_exclusive_with = tagForm.mutually_exclusive_with
      } else {
        found = ncList.find(t => t.id === editingTag.value.id)
        if (found) {
          found.display_name = tagForm.display_name
          found.combinable = tagForm.combinable
          found.mutually_exclusive_with = tagForm.mutually_exclusive_with
        }
      }
      // 如果可组合性变了，需要移动到不同数组
      // 简化处理：重新分类
      const all = [...(currentTags.combinable || []), ...(currentTags.nonCombinable || [])]
      currentTags.combinable = all.filter(t => t.combinable !== false)
      currentTags.nonCombinable = all.filter(t => t.combinable === false)
    } else {
      // 添加新标签 — 确保 ID 不与已有标签冲突
      const allExisting = [...(currentTags.combinable || []), ...(currentTags.nonCombinable || [])];
      const maxId = allExisting.reduce((max, t) => Math.max(max, typeof t.id === 'number' ? t.id : 0), 0);
      const newId = Math.max(maxId + 1, currentTags.nextId || 1);
      currentTags.nextId = newId + 1;

      const newTag = { id: newId, name: tagForm.name, display_name: tagForm.display_name, combinable: tagForm.combinable, mutually_exclusive_with: tagForm.mutually_exclusive_with }
      if (tagForm.combinable) {
        if (!currentTags.combinable) currentTags.combinable = []
        currentTags.combinable.push(newTag)
      } else {
        if (!currentTags.nonCombinable) currentTags.nonCombinable = []
        currentTags.nonCombinable.push(newTag)
      }
    }
    await api.post('/api/admin/tags', currentTags)
    await fetchTags()
    closeTagModal()
  } catch (err) { alert('操作失败: ' + err.message) }
}

const deleteTag = async (tag) => {
  if (!confirm(`确定删除标签 "${tag.display_name || tag.name}"？关联的图片标签也会被清除。`)) return
  try {
    if (tag.isUserTag || tag.isPublicUserTag) {
      // 用户标签：从 user_tags 表删除
      const tagId = typeof tag.id === 'string' ? parseInt(tag.id.substring(1)) : tag.id
      await api.del(`/api/user-tags/${tagId}`)
    } else {
      // 系统标签：从 tags 表直接删除
      await api.del(`/api/admin/tags/${tag.id}`)
    }
    await fetchTags()
  } catch (err) { alert('删除失败: ' + err.message) }
}

const toggleTagPublic = async (tag, event) => {
  const isPublic = event.target.checked
  try {
    const tagId = typeof tag.id === 'string' ? parseInt(tag.id.substring(1)) : tag.id
    await api.post('/api/admin/tag-convert/toggle', {
      tagId,
      isUserTag: !!tag.isUserTag
    })
    await fetchTags()
  } catch (err) {
    alert('操作失败: ' + (err.data?.error || err.message))
    event.target.checked = !isPublic
  }
}

// 人工标签
const manualImages = ref([])
const manualTotal = ref(0)
const manualPage = ref(1)
const manualSort = ref('created_at')
const manualAlbum = ref(null)
const manualSelected = ref([])
const manualTagIds = ref([])
const manualOverwrite = ref(false)
const manualLoading = ref(false)
const manualResult = ref('')
const albums = ref([])

const loadManualImages = async (p = 1) => {
  manualPage.value = p
  try {
    const data = await api.get('/api/internal/images', {
      page: p, limit: 10, sort: manualSort.value, order: 'desc',
      album: manualAlbum.value || undefined
    })
    manualImages.value = data.images || []
    manualTotal.value = data.total || 0
  } catch {}
}

const toggleManualSelect = (id) => {
  const idx = manualSelected.value.indexOf(id)
  if (idx >= 0) manualSelected.value.splice(idx, 1)
  else manualSelected.value.push(id)
}

const getThumbUrl = (img) => {
  const url = img.thumb_url || img.url
  return url ? `${config.public.apiBase || ''}${url}` : ''
}

const runManualTag = async () => {
  if (manualSelected.value.length === 0 || manualTagIds.value.length === 0) return alert('请选择图片和标签')
  manualLoading.value = true; manualResult.value = ''
  try {
    const data = await api.post('/api/admin/tags/run/manual', {
      imageIds: manualSelected.value, tagIds: manualTagIds.value, overwrite: manualOverwrite.value
    })
    manualResult.value = data.message || '标签完成'
    manualSelected.value = []
    await loadManualImages(manualPage.value)
  } catch (err) { manualResult.value = '失败: ' + err.message }
  finally { manualLoading.value = false }
}

// 通用配置
const tagConfig = reactive({ delayMinutes: 5, diffThreshold: 0.5 })

const saveTagConfig = async () => {
  try {
    await api.put('/api/admin/site-config', { tagDelayMinutes: tagConfig.delayMinutes, tagDiffThreshold: tagConfig.diffThreshold })
    alert('配置已保存')
  } catch (err) { alert('保存失败: ' + err.message) }
}

onMounted(async () => {
  await fetchAdminTags()
  await loadManualImages()
  try {
    const aData = await api.get('/api/internal/albums')
    albums.value = aData.albums || []
    const sData = await api.get('/api/admin/site-config')
    tagConfig.delayMinutes = sData.tagDelayMinutes || 5
    tagConfig.diffThreshold = sData.tagDiffThreshold || 0.5
  } catch {}
})

// 标签分组管理
const tagGroups = ref([])
const showAddGroup = ref(false)
const editingGroup = ref(null)
const groupForm = reactive({ name: '', tagIds: [] })
const editingSubgroup = ref(null)
const subgroupForm = reactive({ groupId: null, subId: null, tagIds: [] })

const allTagsList = computed(() => {
  return [...(tags.value.combinable || []), ...(tags.value.nonCombinable || [])]
})

const loadGroups = async () => {
  try {
    const data = await api.get('/api/admin/tag-groups')
    tagGroups.value = data.groups || []
  } catch {}
}

onMounted(() => { loadGroups() })

const openEditGroup = (group) => {
  editingGroup.value = group
  groupForm.name = group.name
  groupForm.tagIds = [...(group.tagIds || [])]
  showAddGroup.value = true
}

const toggleGroupTag = (id) => {
  const idx = groupForm.tagIds.indexOf(id)
  if (idx >= 0) groupForm.tagIds.splice(idx, 1)
  else groupForm.tagIds.push(id)
}

const saveGroup = async () => {
  try {
    if (editingGroup.value) {
      await api.put(`/api/admin/tag-groups/${editingGroup.value.id}`, { name: groupForm.name, tagIds: groupForm.tagIds })
    } else {
      if (!groupForm.name) return alert('请输入分组名')
      await api.post('/api/admin/tag-groups', { name: groupForm.name })
    }
    showAddGroup.value = false; editingGroup.value = null
    groupForm.name = ''; groupForm.tagIds = []
    await loadGroups()
  } catch (err) { alert('操作失败: ' + err.message) }
}

const deleteGroup = async (group) => {
  if (!confirm(`确定删除分组 "${group.name}"？`)) return
  try {
    await api.del(`/api/admin/tag-groups/${group.id}`)
    await loadGroups()
  } catch (err) { alert('删除失败') }
}

const openAddSubgroup = (group) => {
  const name = prompt('输入子分组名称')
  if (!name) return
  api.post(`/api/admin/tag-groups/${group.id}/subgroup`, { name }).then(() => loadGroups())
}

const openEditSubgroup = (group, sg) => {
  editingSubgroup.value = sg
  subgroupForm.groupId = group.id
  subgroupForm.subId = sg.sid  // 使用 sid 而非 id
  subgroupForm.tagIds = [...(sg.tagIds || [])]
}

const toggleSubgroupTag = (id) => {
  const idx = subgroupForm.tagIds.indexOf(id)
  if (idx >= 0) subgroupForm.tagIds.splice(idx, 1)
  else subgroupForm.tagIds.push(id)
}

const saveSubgroup = async () => {
  try {
    await api.put(`/api/admin/tag-groups/${subgroupForm.groupId}/subgroup/${subgroupForm.subId}`, { tagIds: subgroupForm.tagIds })
    editingSubgroup.value = null
    await loadGroups()
  } catch (err) { alert('保存失败') }
}

const deleteSubgroup = async (group, sg) => {
  if (!confirm(`确定删除子分组 "${sg.name}"？`)) return
  try {
    await api.del(`/api/admin/tag-groups/${group.id}/subgroup/${sg.sid}`)  // 使用 sid
    await loadGroups()
  } catch (err) { alert('删除失败') }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.tabs { display: flex; gap: 2px; margin-bottom: var(--space-lg); background: var(--fluent-hover); border-radius: var(--radius-sm); padding: 2px; width: fit-content; }
.tab-btn { padding: 8px 20px; border: none; background: transparent; border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; transition: all var(--transition-fast); }
.tab-btn.active { background: white; box-shadow: var(--shadow-1); font-weight: 500; }
.tab-content { padding: var(--space-lg); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.tag-table { border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); overflow: hidden; }
.table-header, .table-row { display: grid; grid-template-columns: 60px 120px 120px 80px 140px; padding: 8px 16px; align-items: center; }
.table-header { background: var(--fluent-hover); font-size: 13px; font-weight: 600; }
.table-row { border-top: 1px solid var(--fluent-border); font-size: 13px; }
.row-actions { display: flex; gap: 6px; }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.desc { color: var(--fluent-text-secondary); margin-bottom: var(--space-lg); }
.toolbar { display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-lg); }
.fluent-select { padding: 6px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 13px; background: white; }
.selected-count { font-size: 13px; color: var(--fluent-text-secondary); margin-left: auto; }
.image-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-md); }
.image-card { cursor: pointer; border: 2px solid transparent; border-radius: var(--radius-md); padding: var(--space-sm); transition: all var(--transition-fast); }
.image-card:hover { border-color: var(--fluent-border); }
.image-card.selected { border-color: var(--fluent-blue); background: var(--fluent-blue-light); }
.card-thumb { position: relative; aspect-ratio: 1; border-radius: var(--radius-sm); overflow: hidden; background: var(--fluent-hover); }
.card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.check-mark { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; background: var(--fluent-blue); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; }
.card-name { font-size: 12px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-md); padding: var(--space-lg) 0; font-size: 13px; color: var(--fluent-text-secondary); }
.manual-action { margin-top: var(--space-xl); padding-top: var(--space-xl); border-top: 1px solid var(--fluent-border); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.result-msg { margin-top: var(--space-md); font-size: 13px; color: var(--fluent-blue); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 450px; padding: var(--space-xl); }
.modal h3 { margin-bottom: var(--space-lg); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
.section-card { margin-top: var(--space-xl); }
.desc { font-size: 13px; color: var(--fluent-text-secondary); margin-bottom: var(--space-md); }
.group-list { display: flex; flex-direction: column; gap: var(--space-md); }
.group-item { border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); padding: var(--space-md); }
.group-header { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; }
.group-name { font-weight: 600; font-size: 15px; }
.group-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.group-actions { display: flex; gap: 6px; margin-left: auto; }
.subgroup-list { margin-top: var(--space-md); padding-left: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-sm); }
.subgroup-item { display: flex; align-items: center; gap: var(--space-sm); padding: 6px 10px; background: var(--fluent-hover); border-radius: var(--radius-sm); }
.sg-name { font-size: 13px; font-weight: 500; }
.sg-count { font-size: 12px; color: var(--fluent-text-secondary); margin-left: auto; }
.btn-sm { padding: 3px 8px; font-size: 12px; }
.tag-picker { display: flex; flex-wrap: wrap; gap: 6px; max-height: 200px; overflow-y: auto; padding: var(--space-sm); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); }
.tag-chip { padding: 3px 10px; border: 1px solid var(--fluent-border); border-radius: 14px; font-size: 12px; cursor: pointer; transition: all var(--transition-fast); }
.tag-chip:hover { background: var(--fluent-hover); }
.tag-chip.selected { background: var(--fluent-blue); color: white; border-color: var(--fluent-blue); }
</style>
