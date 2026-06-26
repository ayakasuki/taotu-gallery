<template>
  <div class="admin-paths">
    <h1 class="page-title">自定义路径管理</h1>

    <!-- 本地图库 -->
    <div class="fluent-card">
      <h3>本地图库路径</h3>
      <div class="path-item">
        <span class="path-value">data/gallery/</span>
        <span class="path-status">默认图库，不可删除</span>
      </div>
    </div>

    <!-- 自定义路径 -->
    <div class="fluent-card" style="margin-top: var(--space-lg);">
      <div class="section-header">
        <h3>自定义外部路径</h3>
        <button class="fluent-btn fluent-btn-primary" @click="showAdd = true">添加路径</button>
      </div>

      <div v-if="customPaths.length > 0" class="path-list">
        <div v-for="(cp, idx) in customPaths" :key="idx" class="path-item">
          <div class="path-info">
            <span class="path-value">{{ cp.path }}</span>
            <span class="path-meta">
              {{ cp.recursive ? '递归子目录' : '仅当前目录' }}
              <span v-if="cp.albumName"> · 相册: {{ cp.albumName }}</span>
              <span v-if="getPathTagNames(cp).length > 0"> · 标签: {{ getPathTagNames(cp).join(', ') }}</span>
            </span>
          </div>
          <div class="path-actions">
            <button class="fluent-btn fluent-btn-secondary" @click="scanPath(cp)">扫描</button>
            <button class="fluent-btn fluent-btn-secondary" @click="removePath(idx)">删除</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-msg">暂无自定义路径</div>

      <div class="actions-bar">
        <button class="fluent-btn fluent-btn-primary" @click="savePaths">保存配置</button>
        <button class="fluent-btn fluent-btn-secondary" @click="scanAll" :disabled="scanning">
          {{ scanning ? '扫描中...' : '扫描所有路径' }}
        </button>
      </div>
      <p v-if="msg" class="result-msg">{{ msg }}</p>
    </div>

    <!-- 添加路径弹窗 -->
    <div v-if="showAdd" class="modal-overlay" @click.self="showAdd = false">
      <div class="modal fluent-card">
        <h3>添加自定义路径</h3>

        <div class="form-group">
          <label>路径（绝对路径或相对路径）</label>
          <input v-model="newPath.path" class="fluent-input" placeholder="/path/to/images" />
        </div>

        <div class="form-group">
          <label><input type="checkbox" v-model="newPath.recursive" /> 递归扫描子目录</label>
        </div>

        <div class="form-group">
          <label>添加到相册</label>
          <select v-model="newPath.albumMode" class="fluent-input">
            <option value="none">无（直接加入图库）</option>
            <option value="existing">选择已有相册</option>
            <option value="new">新建相册</option>
          </select>
        </div>

        <div class="form-group" v-if="newPath.albumMode === 'existing'">
          <label>选择相册</label>
          <select v-model="newPath.albumId" class="fluent-input">
            <option :value="null">请选择</option>
            <option v-for="a in albums" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>

        <div class="form-group" v-if="newPath.albumMode === 'new'">
          <label>新相册名称</label>
          <input v-model="newPath.albumName" class="fluent-input" placeholder="输入相册名" />
        </div>

        <div class="form-group">
          <label>批量打标签（可选）</label>
          <TagGroupSelector
            :tags="{ combinable: allTags.filter(t => t.combinable !== false), nonCombinable: allTags.filter(t => t.combinable === false) }"
            :selectedTagIds="newPath.tagIds"
            @update:selectedTagIds="newPath.tagIds = $event"
          />
          <div class="tag-divider"></div>
          <div class="new-tag-inline">
            <input v-model="newPath.newTagName" class="fluent-input-sm" placeholder="新建标签名" @keyup.enter="addNewTagToPath" />
            <button v-if="newPath.newTagName" class="fluent-btn fluent-btn-secondary btn-sm" @click="addNewTagToPath">添加</button>
          </div>
          <div v-if="newPath.newTagNames.length > 0" class="new-tags-preview">
            <span v-for="(name, idx) in newPath.newTagNames" :key="idx" class="new-tag-chip">
              {{ name }} <button @click="newPath.newTagNames.splice(idx, 1)">×</button>
            </span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="addPath">添加</button>
          <button class="fluent-btn fluent-btn-secondary" @click="showAdd = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TagGroupSelector from '~/components/tags/TagGroupSelector.vue'

definePageMeta({ layout: 'admin' })

const api = useApi()
const customPaths = ref([])
const albums = ref([])
const allTags = ref([])
const showAdd = ref(false)
const scanning = ref(false)
const msg = ref('')

const newPath = reactive({
  path: '',
  recursive: true,
  albumMode: 'none',
  albumId: null,
  albumName: '',
  tagIds: [],
  newTagName: '',
  newTagNames: []
})

onMounted(async () => {
  await loadConfig()
  await loadAlbums()
  await loadTags()
})

const loadConfig = async () => {
  try {
    const data = await api.get('/api/admin/gallery/config')
    customPaths.value = data.customPaths || []
  } catch {}
}

const loadAlbums = async () => {
  try {
    const data = await api.get('/api/admin/albums')
    albums.value = data.albums || []
  } catch {}
}

const loadTags = async () => {
  try {
    const data = await api.get('/api/admin/tags')
    allTags.value = [...(data.combinable || []), ...(data.nonCombinable || [])]
  } catch {}
}

const getPathTagNames = (cp) => {
  const selectedNames = allTags.value
    .filter(t => (cp.tagIds || []).includes(t.id))
    .map(t => t.display_name || t.name)
  return selectedNames.concat(cp.newTagNames || cp.tagNames || [])
}

const addNewTagToPath = () => {
  const name = newPath.newTagName.trim()
  if (!name || newPath.newTagNames.includes(name)) return
  newPath.newTagNames.push(name)
  newPath.newTagName = ''
}

const addPath = () => {
  if (!newPath.path) return alert('请输入路径')

  const entry = {
    path: newPath.path,
    recursive: newPath.recursive,
    albumMode: newPath.albumMode,
    albumId: newPath.albumMode === 'existing' ? newPath.albumId : null,
    albumName: newPath.albumMode === 'new' ? newPath.albumName : '',
    tagIds: [...newPath.tagIds],
    newTagNames: [...newPath.newTagNames]
  }

  // 显示用
  entry.tagNames = allTags.value
    .filter(t => newPath.tagIds.includes(t.id))
    .map(t => t.display_name || t.name)
    .concat(newPath.newTagNames)

  customPaths.value.push(entry)

  // 重置
  newPath.path = ''; newPath.recursive = true; newPath.albumMode = 'none'
  newPath.albumId = null; newPath.albumName = ''
  newPath.tagIds = []; newPath.newTagName = ''; newPath.newTagNames = []
  showAdd.value = false
}

const removePath = (idx) => {
  customPaths.value.splice(idx, 1)
}

const savePaths = async () => {
  try {
    await api.put('/api/admin/gallery/config', { customPaths: customPaths.value })
    msg.value = '路径配置已保存'
  } catch (err) { msg.value = '保存失败: ' + err.message }
}

const scanPath = async (cp) => {
  scanning.value = true; msg.value = ''
  try {
    const data = await api.post('/api/admin/gallery/scan-path', {
      path: cp.path,
      recursive: cp.recursive,
      albumId: cp.albumId || null,
      albumName: cp.albumName || null,
      tagIds: cp.tagIds || [],
      newTags: cp.newTagNames || []
    })
    msg.value = `扫描完成: 新增 ${data.added}, 跳过 ${data.skipped}`
  } catch (err) { msg.value = '扫描失败: ' + err.message }
  finally { scanning.value = false }
}

const scanAll = async () => {
  scanning.value = true; msg.value = ''
  try {
    const data = await api.post('/api/admin/gallery/scan')
    msg.value = `扫描完成: 新增 ${data.added}, 跳过 ${data.skipped}`
  } catch (err) { msg.value = '扫描失败: ' + err.message }
  finally { scanning.value = false }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.path-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.path-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-md); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); }
.path-info { display: flex; flex-direction: column; gap: 4px; }
.path-value { font-family: monospace; font-size: 14px; }
.path-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.path-actions { display: flex; gap: var(--space-sm); }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.actions-bar { display: flex; gap: var(--space-md); margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--fluent-border); }
.result-msg { margin-top: var(--space-md); font-size: 13px; color: var(--fluent-blue); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.tag-selector-inline { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-sm); }
.tag-chip { padding: 3px 10px; border: 1px solid var(--fluent-border); border-radius: 14px; font-size: 12px; cursor: pointer; transition: all var(--transition-fast); }
.tag-chip:hover { background: var(--fluent-hover); }
.tag-chip.selected { background: var(--fluent-blue); color: white; border-color: var(--fluent-blue); }
.new-tag-inline { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); }
.fluent-input-sm { flex: 1; padding: 5px 10px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 13px; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.tag-divider { border-top: 1px solid var(--fluent-border); margin: var(--space-md) 0; }
.new-tags-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-sm); }
.new-tag-chip { font-size: 12px; padding: 2px 8px; background: #e6f4ea; color: #107c10; border-radius: 12px; display: flex; align-items: center; gap: 4px; }
.new-tag-chip button { background: none; border: none; cursor: pointer; font-size: 14px; color: #107c10; padding: 0; line-height: 1; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 550px; padding: var(--space-xl); }
.modal h3 { margin-bottom: var(--space-lg); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
</style>
