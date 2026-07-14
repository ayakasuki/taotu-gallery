<template>
  <div class="admin-tags-page">
    <ManualImageHoverPreview ref="manualPreviewRef" />
    <section class="tags-frame">
      <nav class="tags-tabs" aria-label="标签设置">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tag-tab-btn"
          type="button"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="activeTab === 'manage'" class="manage-grid">
        <article class="tag-list-card glass-card">
          <header class="tag-card-header">
            <h2>标签列表</h2>
            <div class="tag-toolbar">
              <label class="search-box">
                <TaotuIcon name="search" />
                <input v-model.trim="tagSearch" placeholder="搜索标签名称 / 显示名 / ID" @keyup.enter="tagPage = 1" />
              </label>
              <TaotuSelect v-model="tagScope" class="soft-select" :options="tagScopeOptions" @change="tagPage = 1" />
              <button type="button" class="primary-action" @click="openAddTag">
                <TaotuIcon name="add" />新建标签
              </button>
            </div>
          </header>

          <div class="bulk-actions">
            <label class="soft-checkbox">
              <input type="checkbox" :checked="currentPageAllSelected" @change="toggleSelectCurrentPage" />
              <span class="taotu-checkbox-icon-pair">
                <TaotuIcon name="checkbox" class="checkbox-unchecked-icon" :stateful="false" />
                <TaotuIcon name="checkbox-checked" class="checkbox-checked-icon" filled :stateful="false" />
              </span>
            </label>
            <strong>已选择 {{ selectedTagIds.length }} 项</strong>
            <button type="button" class="bulk-btn purple" :disabled="selectedTagIds.length === 0" @click="setSelectedTagsPublic">
              <TaotuIcon name="public" />批量设为公共
            </button>
            <button type="button" class="bulk-btn danger" :disabled="selectedTagIds.length === 0" @click="deleteSelectedTags">
              <TaotuIcon name="trash" />批量删除
            </button>
          </div>

          <div class="tag-table-shell">
            <div class="tag-table-head">
              <span>
                <label class="soft-checkbox mini">
                  <input type="checkbox" :checked="currentPageAllSelected" @change="toggleSelectCurrentPage" />
                  <span class="taotu-checkbox-icon-pair">
                    <TaotuIcon name="checkbox" class="checkbox-unchecked-icon" :stateful="false" />
                    <TaotuIcon name="checkbox-checked" class="checkbox-checked-icon" filled :stateful="false" />
                  </span>
                </label>
              </span>
              <span>ID</span>
              <span>名称</span>
              <span>显示名</span>
              <span>是否公共</span>
              <span>是否可组合</span>
              <span>操作</span>
            </div>
            <div class="tag-table-body pretty-scroll">
              <div v-if="pagedTags.length === 0" class="empty-line">暂无标签数据</div>
              <div v-for="tag in pagedTags" :key="tagKey(tag)" class="tag-table-row">
                <span>
                  <label class="soft-checkbox mini">
                    <input
                      type="checkbox"
                      :checked="selectedTagIds.includes(tagKey(tag))"
                      :disabled="tag.isSystemTag"
                      @change="toggleTagSelect(tag)"
                    />
                    <span class="taotu-checkbox-icon-pair">
                      <TaotuIcon name="checkbox" class="checkbox-unchecked-icon" :stateful="false" />
                      <TaotuIcon name="checkbox-checked" class="checkbox-checked-icon" filled :stateful="false" />
                    </span>
                  </label>
                </span>
                <span class="tag-id">{{ tagKey(tag) }}</span>
                <span>{{ tag.name }}</span>
                <span>{{ tag.display_name || tag.name }}</span>
                <span>{{ isTagPublic(tag) ? '是' : '否' }}</span>
                <span>{{ tag.combinable === false ? '否' : '是' }}</span>
                <span class="row-actions">
                  <button type="button" class="text-action edit" @click="openEditTag(tag)">编辑</button>
                  <button type="button" class="text-action delete" :disabled="tag.isSystemTag" @click="deleteTag(tag)">删除</button>
                </span>
              </div>
            </div>
          </div>

          <footer class="tag-pagination">
            <span>共 {{ filteredTags.length }} 条数据</span>
            <div class="pager">
              <button type="button" :disabled="tagPage <= 1" @click="goTagPage(tagPage - 1)">
                <TaotuIcon name="pagination-prev" />
              </button>
              <button
                v-for="item in tagPageItems"
                :key="item.key"
                type="button"
                :class="{ active: item.page === tagPage, ellipsis: item.ellipsis }"
                :disabled="item.ellipsis"
                @click="!item.ellipsis && goTagPage(item.page)"
              >
                {{ item.label }}
              </button>
              <button type="button" :disabled="tagPage >= tagTotalPages" @click="goTagPage(tagPage + 1)">
                <TaotuIcon name="pagination-next" />
              </button>
            </div>
            <TaotuSelect v-model="tagPageSize" class="page-size-select" :options="tagPageSizeOptions" @change="tagPage = 1" />
          </footer>
        </article>

        <aside class="group-card glass-card">
          <header class="group-card-header">
            <h2>标签分组管理</h2>
            <button type="button" class="outline-action" @click="openCreateGroup">
              <TaotuIcon name="add" />新建分组
            </button>
          </header>

          <div class="group-tree pretty-scroll">
            <div class="group-node all-tags active clickable" @click="groupRootExpanded = !groupRootExpanded">
              <button type="button" class="chevron-icon" :class="{ expanded: groupRootExpanded }" aria-label="全部标签">
                <TaotuIcon name="chevron-down" />
              </button>
              <strong>全部标签</strong>
              <em>({{ manageableTags.length }})</em>
              <div class="group-node-actions">
                <button type="button" title="全部标签不可编辑" disabled><TaotuIcon name="edit" /></button>
                <button type="button" title="全部标签不可删除" disabled><TaotuIcon name="trash" /></button>
              </div>
            </div>

            <div v-if="groupRootExpanded">
              <div v-for="group in editableGroups" :key="group.id" class="group-section">
                <div class="group-node clickable" @click="toggleGroupExpand(groupKey(group))">
                  <button type="button" class="chevron-icon" :class="{ expanded: expandedGroups.includes(groupKey(group)) }">
                    <TaotuIcon name="chevron-down" />
                  </button>
                  <strong>{{ group.name }}</strong>
                  <em>({{ groupTagCount(group) }})</em>
                  <div class="group-node-actions">
                    <button type="button" title="编辑分组" @click.stop="openEditGroup(group)"><TaotuIcon name="edit" /></button>
                    <button type="button" title="删除分组" @click.stop="deleteGroup(group)"><TaotuIcon name="trash" /></button>
                  </div>
                </div>
                <div v-if="expandedGroups.includes(groupKey(group))" class="sub-tree">
                  <div v-for="sg in group.subgroups || []" :key="sg.sid" class="sub-node">
                    <i></i>
                    <strong>{{ sg.name }}</strong>
                    <em>({{ subgroupTagCount(sg) }})</em>
                    <div class="group-node-actions">
                      <button type="button" title="编辑子分组" @click="openEditSubgroup(group, sg)"><TaotuIcon name="edit" /></button>
                      <button type="button" title="删除子分组" @click="deleteSubgroup(group, sg)"><TaotuIcon name="trash" /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section v-else class="manual-grid">
        <article class="manual-images-card glass-card">
          <header class="manual-title">
            <h2>人工标签</h2>
            <p>通过人工方式为图片打上平台标签</p>
          </header>

          <div class="manual-filters">
            <label>
              <span>来源</span>
              <TaotuSelect v-model="manualSource" :options="manualSourceOptions" @change="switchManualSource" />
            </label>
            <label :class="{ disabled: manualSource !== 'user' }">
              <span>用户</span>
              <TaotuSelect v-model="manualUserId" :options="manualUserOptions" :disabled="manualSource !== 'user'" @change="reloadManualContext" />
            </label>
            <label>
              <span>排序</span>
              <TaotuSelect v-model="manualSort" :options="manualSortOptions" @change="loadManualImages(1)" />
            </label>
            <label>
              <span>相册</span>
              <TaotuSelect v-model="manualAlbum" :options="manualAlbumOptions" :disabled="manualSource === 'user' && !manualUserId" @change="loadManualImages(1)" />
            </label>
          </div>

          <div class="manual-select-line">
            <span>请选择需要打标签的图片（已选择 {{ manualSelected.length }} 张）</span>
            <span class="manual-hover-tip">
              <TaotuIcon name="visibility-info" />
              鼠标停留图片出现该图预览
            </span>
          </div>
          <div class="manual-image-grid pretty-scroll">
            <button
              v-for="img in manualImages"
              :key="img.id"
              type="button"
              class="manual-image"
              :class="{ selected: manualSelected.includes(img.id) }"
              @mouseenter="showManualPreview(img, $event.currentTarget)"
              @mouseleave="hideManualPreview"
              @focus="showManualPreview(img, $event.currentTarget)"
              @blur="hideManualPreview"
              @click="toggleManualSelect(img.id)"
            >
              <img :src="getThumbUrl(img)" :alt="img.filename" loading="lazy" />
              <span v-if="manualSelected.includes(img.id)" class="manual-check-mark">
                <TaotuIcon name="选中" />
              </span>
            </button>
          </div>
          <div v-if="manualImages.length === 0" class="manual-empty">
            {{ manualSource === 'user' && !manualUserId ? '请选择用户后查看图片' : '暂无图片' }}
          </div>

          <footer class="manual-pagination">
            <span>共 {{ manualTotal }} 张</span>
            <div class="pager">
              <button type="button" :disabled="manualPage <= 1" @click="loadManualImages(manualPage - 1)">
                <TaotuIcon name="pagination-prev" />
              </button>
              <button
                v-for="item in manualPageItems"
                :key="item.key"
                type="button"
                :class="{ active: item.page === manualPage, ellipsis: item.ellipsis }"
                :disabled="item.ellipsis"
                @click="!item.ellipsis && loadManualImages(item.page)"
              >
                {{ item.label }}
              </button>
              <button type="button" :disabled="manualPage >= manualTotalPages" @click="loadManualImages(manualPage + 1)">
                <TaotuIcon name="pagination-next" />
              </button>
            </div>
            <TaotuSelect v-model="manualPageSize" class="page-size-select" :options="manualPageSizeOptions" @change="loadManualImages(1)" />
          </footer>
        </article>

        <aside class="manual-side">
          <section class="manual-select-card glass-card">
            <header>
              <h3>选择标签 <span>（可多选）</span></h3>
              <button type="button" @click="clearManualTags">清空</button>
            </header>
            <input
              v-model.trim="manualTagDraft"
              class="manual-tag-input"
              placeholder="请输入新平台标签，回车后暂存"
              @keydown.enter.prevent="addManualDraftTag"
            />
            <p>已选择 {{ manualSelectedTagChips.length }} 个标签</p>
            <div class="selected-tag-box">
              <span v-if="manualSelectedTagChips.length === 0" class="empty-chip">未选择标签</span>
              <button v-for="tag in manualSelectedTagChips" :key="tag.key" type="button" @click="removeManualTag(tag)">
                {{ tag.label }} <i>×</i>
              </button>
            </div>

            <div class="manual-tag-tree pretty-scroll">
              <div v-for="group in manualTreeGroups" :key="group.key" class="manual-tree-group">
                <button type="button" class="manual-tree-title" @click="toggleManualGroup(group.key)">
                  <span class="manual-chevron" :class="{ expanded: manualExpandedGroups.includes(group.key) }">
                    <TaotuIcon name="chevron-down" />
                  </span>{{ group.name }} <em>({{ group.tags.length + group.children.reduce((sum, child) => sum + child.tags.length, 0) }})</em>
                </button>
                <div v-if="manualExpandedGroups.includes(group.key)" class="manual-tree-content">
                  <button
                    v-for="tag in group.tags"
                    :key="tagKey(tag)"
                    type="button"
                    :class="{ selected: manualTagIds.includes(tagKey(tag)) }"
                    @click="toggleManualTag(tag)"
                  >
                    {{ tag.display_name || tag.name }}
                  </button>
                  <div v-for="child in group.children" :key="child.key" class="manual-subgroup">
                    <button type="button" class="manual-tree-title child" @click="toggleManualGroup(child.key)">
                      <span class="manual-chevron" :class="{ expanded: manualExpandedGroups.includes(child.key) }">
                        <TaotuIcon name="chevron-down" />
                      </span>{{ child.name }} <em>({{ child.tags.length }})</em>
                    </button>
                    <div v-if="manualExpandedGroups.includes(child.key)" class="manual-tree-content child">
                      <button
                        v-for="tag in child.tags"
                        :key="tagKey(tag)"
                        type="button"
                        :class="{ selected: manualTagIds.includes(tagKey(tag)) }"
                        @click="toggleManualTag(tag)"
                      >
                        {{ tag.display_name || tag.name }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="manual-execute-card glass-card">
            <label class="soft-checkbox execute-check">
              <input type="checkbox" v-model="manualOverwrite" />
              <span class="taotu-checkbox-icon-pair">
                <TaotuIcon name="checkbox" class="checkbox-unchecked-icon" :stateful="false" />
                <TaotuIcon name="checkbox-checked" class="checkbox-checked-icon" filled :stateful="false" />
              </span>
              <span>
                覆盖已有标签
                <TaotuIcon name="visibility-info" title="勾选后将覆盖图片已存在的平台手动标签。" />
              </span>
            </label>
            <p>勾选后将覆盖图片已存在的平台手动标签</p>
            <button
              type="button"
              class="run-manual-btn"
              :disabled="manualLoading || manualSelected.length === 0 || manualSelectedTagChips.length === 0 || (manualSource === 'user' && !manualUserId)"
              @click="runManualTag"
            >
              <TaotuIcon name="scan" />{{ manualLoading ? '执行中...' : '执行人工标签' }}
            </button>
            <strong>将为选中的 {{ manualSelected.length }} 张图片打上所选标签</strong>
          </section>
        </aside>
      </section>
    </section>

    <div v-if="showTagModal" class="modal-overlay" @click.self="closeTagModal">
      <section class="tag-modal">
        <header>
          <h2>{{ editingTag ? '编辑标签' : '新建标签' }}</h2>
          <button type="button" @click="closeTagModal">×</button>
        </header>
        <label class="modal-field">
          <span>标签名称 <i>*</i></span>
          <div>
            <input v-model.trim="tagForm.name" maxlength="64" placeholder="请输入标签名称（英文或下划线，唯一）" />
            <em>{{ tagForm.name.length }}/64</em>
          </div>
        </label>
        <label class="modal-field">
          <span>显示名 <i>*</i></span>
          <div>
            <input v-model.trim="tagForm.display_name" maxlength="64" placeholder="请输入显示名" />
            <em>{{ tagForm.display_name.length }}/64</em>
          </div>
        </label>
        <label class="modal-toggle">
          <span>是否可组合</span>
          <label class="pink-switch">
            <input type="checkbox" v-model="tagForm.combinable" />
            <i></i>
          </label>
        </label>
        <label class="modal-toggle">
          <span>是否公共</span>
          <label class="pink-switch">
            <input type="checkbox" v-model="tagForm.is_public" />
            <i></i>
          </label>
        </label>
        <label class="modal-field">
          <span>互斥标签 ID <b>（u13 形式，多个用逗号分隔）</b></span>
          <div>
            <input v-model.trim="tagForm.mutually_exclusive_with" placeholder="例如：u13,u27,u35" />
          </div>
          <small>与列表中任一标签互斥，无法同时生效</small>
        </label>
        <footer>
          <button type="button" class="cancel-btn" @click="closeTagModal">取消</button>
          <button type="button" class="save-btn" @click="saveTag">保存</button>
        </footer>
      </section>
    </div>

    <div v-if="showGroupModal" class="modal-overlay" @click.self="closeGroupModal">
      <section class="tag-modal group-modal">
        <header>
          <h2>{{ groupModalTitle }}</h2>
          <button type="button" @click="closeGroupModal">×</button>
        </header>
        <label class="modal-field">
          <span>分组名称 <i>*</i></span>
          <div>
            <input v-model.trim="groupForm.name" maxlength="64" placeholder="请输入分组名称" />
            <em>{{ groupForm.name.length }}/64</em>
          </div>
        </label>
        <button v-if="groupModalMode === 'edit-group'" type="button" class="add-subgroup-btn" @click="openCreateSubgroup(editingGroup)">
          <TaotuIcon name="add" />新建子分组
        </button>
        <label v-if="groupModalShowsTags" class="modal-field tag-select-field">
          <span>分组内标签（可多选）</span>
          <div class="tag-picker pretty-scroll">
            <button
              v-for="tag in allTagsList"
              :key="tagKey(tag)"
              type="button"
              :class="{ selected: groupForm.tagIds.includes(tagKey(tag)) }"
              @click="toggleGroupTag(tagKey(tag))"
            >
              {{ tag.display_name || tag.name }}
            </button>
          </div>
        </label>
        <footer>
          <button type="button" class="cancel-btn" @click="closeGroupModal">取消</button>
          <button type="button" class="save-btn" @click="saveGroupModal">保存</button>
        </footer>
      </section>
    </div>

    <ConfirmDeleteDialog
      :show="deleteDialog.show"
      :title="deleteDialog.title"
      :message="deleteDialog.message"
      :description="deleteDialog.description"
      :effects="deleteDialog.effects"
      :loading="deleteDialog.loading"
      @confirm="confirmDeleteDialog"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const config = useRuntimeConfig()
const { tags } = useTags()
const { showAdminToast } = useAdminToast()

const activeTab = ref('manage')
const tabs = [
  { key: 'manage', label: '标签管理' },
  { key: 'manual', label: '人工标签' }
]
const tagScopeOptions = [
  { label: '全部', value: 'all' },
  { label: '公共标签', value: 'public' },
  { label: '私有标签', value: 'private' },
  { label: '可组合', value: 'combinable' },
  { label: '互斥', value: 'exclusive' }
]
const tagPageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 }
]
const manualSourceOptions = [
  { label: '全部图库', value: 'all' },
  { label: '公共图库', value: 'public' },
  { label: '我的图库', value: 'mine' },
  { label: '用户图库', value: 'user' }
]
const manualSortOptions = [
  { label: '最新', value: 'created_at' },
  { label: '最热门', value: 'view_count' },
  { label: '文件名', value: 'filename' }
]
const manualPageSizeOptions = [
  { label: '16 条/页', value: 16 },
  { label: '32 条/页', value: 32 }
]

const allTags = ref([])
const tagGroups = ref([])
const users = ref([])
const groupRootExpanded = ref(true)

const tagSearch = ref('')
const tagScope = ref('all')
const tagPage = ref(1)
const tagPageSize = ref(10)
const selectedTagIds = ref([])

const showTagModal = ref(false)
const editingTag = ref(null)
const tagForm = reactive({ name: '', display_name: '', combinable: true, is_public: true, mutually_exclusive_with: '' })
const deleteDialog = reactive({
  show: false,
  type: '',
  payload: null,
  title: '确认删除',
  message: '',
  description: '此操作不可恢复，请谨慎操作。',
  effects: [],
  loading: false
})

const expandedGroups = ref([])
const showGroupModal = ref(false)
const groupModalMode = ref('create-group')
const editingGroup = ref(null)
const editingSubgroup = ref(null)
const parentGroup = ref(null)
const groupForm = reactive({ name: '', tagIds: [] })

const manualImages = ref([])
const manualTotal = ref(0)
const manualPage = ref(1)
const manualPageSize = ref(16)
const manualSort = ref('created_at')
const manualAlbum = ref(null)
const manualSource = ref('all')
const manualUserId = ref(null)
const manualSelected = ref([])
const manualTagIds = ref([])
const manualNewTagNames = ref([])
const manualTagDraft = ref('')
const manualOverwrite = ref(false)
const manualLoading = ref(false)
const manualPreviewRef = ref(null)
const albums = ref([])
const manualExpandedGroups = ref(['ungrouped'])

const manageableTags = computed(() => allTags.value.filter(tag => !tag.isSystemTag))
const allTagsList = computed(() => manageableTags.value)

const filteredTags = computed(() => {
  const keyword = tagSearch.value.trim().toLowerCase()
  return manageableTags.value.filter(tag => {
    const id = tagKey(tag).toLowerCase()
    const haystack = [id, tag.name, tag.display_name].filter(Boolean).join(' ').toLowerCase()
    if (keyword && !haystack.includes(keyword)) return false
    if (tagScope.value === 'public') return isTagPublic(tag)
    if (tagScope.value === 'private') return !isTagPublic(tag)
    if (tagScope.value === 'combinable') return tag.combinable !== false
    if (tagScope.value === 'exclusive') return tag.combinable === false
    return true
  })
})

const tagTotalPages = computed(() => Math.max(1, Math.ceil(filteredTags.value.length / tagPageSize.value)))
const pagedTags = computed(() => {
  const start = (tagPage.value - 1) * tagPageSize.value
  return filteredTags.value.slice(start, start + tagPageSize.value)
})
const tagPageItems = computed(() => buildPageItems(tagPage.value, tagTotalPages.value))
const currentPageAllSelected = computed(() => {
  const selectable = pagedTags.value.filter(tag => !tag.isSystemTag)
  return selectable.length > 0 && selectable.every(tag => selectedTagIds.value.includes(tagKey(tag)))
})

const editableGroups = computed(() => tagGroups.value.filter(group => !group.system && group.id !== '__system'))

const albumPlaceholder = computed(() => {
  if (manualSource.value === 'public') return '全部公共相册'
  if (manualSource.value === 'mine') return '我的全部相册'
  if (manualSource.value === 'user') return manualUserId.value ? '该用户全部相册' : '请先选择用户'
  return '全部相册'
})
const manualUserOptions = computed(() => [
  { label: '请选择用户', value: null },
  ...users.value.map(user => ({ label: user.username, value: user.id, description: user.email || `用户 ID：${user.id}` }))
])
const manualAlbumOptions = computed(() => [
  { label: albumPlaceholder.value, value: null },
  ...albums.value.map(album => ({ label: album.name, value: album.id, description: `${album.image_count || album.imageCount || 0} 张图片` }))
])
const manualTotalPages = computed(() => Math.max(1, Math.ceil((manualTotal.value || 0) / manualPageSize.value)))
const manualPageItems = computed(() => buildPageItems(manualPage.value, manualTotalPages.value))

const manualSelectableTags = computed(() => {
  return allTags.value.filter(tag => !(tag.isSystemTag || tag.isUserTag || tag.isPublicUserTag || String(tag.id).startsWith('u')))
})

const manualSelectedTagChips = computed(() => {
  const existing = manualTagIds.value
    .map(id => manualSelectableTags.value.find(tag => tagKey(tag) === id))
    .filter(Boolean)
    .map(tag => ({ key: tagKey(tag), label: tag.display_name || tag.name, type: 'existing' }))
  const drafts = manualNewTagNames.value.map(name => ({ key: `new:${name}`, label: name, type: 'new' }))
  return [...existing, ...drafts]
})

const manualTreeGroups = computed(() => {
  const tagsById = new Map(manualSelectableTags.value.map(tag => [tagKey(tag), tag]))
  const used = new Set()
  const groups = editableGroups.value.map(group => {
    const groupTags = (group.tagIds || [])
      .map(id => tagsById.get(normalizeTagId(id)))
      .filter(Boolean)
    groupTags.forEach(tag => used.add(tagKey(tag)))
    const children = (group.subgroups || []).map(sub => {
      const childTags = (sub.tagIds || [])
        .map(id => tagsById.get(normalizeTagId(id)))
        .filter(Boolean)
      childTags.forEach(tag => used.add(tagKey(tag)))
      return { key: `sub-${group.id}-${sub.sid}`, name: sub.name, tags: childTags }
    }).filter(child => child.tags.length > 0)
    return { key: `group-${group.id}`, name: group.name, tags: groupTags, children }
  }).filter(group => group.tags.length > 0 || group.children.length > 0)

  const ungrouped = manualSelectableTags.value.filter(tag => !used.has(tagKey(tag)))
  return [
    { key: 'ungrouped', name: '未分组标签', tags: ungrouped, children: [] },
    ...groups
  ]
})

const groupModalTitle = computed(() => {
  if (groupModalMode.value === 'edit-group') return '编辑分组'
  if (groupModalMode.value === 'create-subgroup') return '新建子分组'
  if (groupModalMode.value === 'edit-subgroup') return '编辑子分组'
  return '新建分组'
})
const groupModalShowsTags = computed(() => groupModalMode.value === 'edit-group' || groupModalMode.value === 'edit-subgroup')

watch([filteredTags, tagPageSize], () => {
  if (tagPage.value > tagTotalPages.value) tagPage.value = tagTotalPages.value
})

watch(manualSource, () => {
  if (manualSource.value !== 'user') manualUserId.value = null
})

onMounted(async () => {
  await Promise.all([fetchAdminTags(), loadGroups(), loadUsers()])
  await reloadManualContext()
})

async function fetchAdminTags() {
  try {
    const data = await api.get('/api/admin/tags')
    tags.value = data
    allTags.value = [...(data.combinable || []), ...(data.nonCombinable || [])]
    selectedTagIds.value = selectedTagIds.value.filter(id => allTags.value.some(tag => tagKey(tag) === id && !tag.isSystemTag))
  } catch (err) {
    showAdminToast('获取标签失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function loadGroups() {
  try {
    const data = await api.get('/api/admin/tag-groups')
    tagGroups.value = data.groups || []
    if (expandedGroups.value.length === 0) {
      expandedGroups.value = editableGroups.value.slice(0, 4).map(group => groupKey(group))
    }
  } catch (err) {
    showAdminToast('获取标签分组失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function loadUsers() {
  try {
    const data = await api.get('/api/admin/users', { all: true })
    users.value = data.users || []
  } catch {}
}

function tagKey(tagOrId) {
  if (tagOrId && typeof tagOrId === 'object') return normalizeTagId(tagOrId.id)
  return normalizeTagId(tagOrId)
}

function normalizeTagId(id) {
  if (typeof id === 'string' && /^u\d+$/i.test(id)) return `u${parseInt(id.slice(1), 10)}`
  if (typeof id === 'string' && id.startsWith('__')) return id
  return String(id)
}

function isTagPublic(tag) {
  return !!tag.is_public
}

function goTagPage(nextPage) {
  if (nextPage < 1 || nextPage > tagTotalPages.value) return
  tagPage.value = nextPage
}

function toggleTagSelect(tag) {
  if (tag.isSystemTag) return
  const id = tagKey(tag)
  const index = selectedTagIds.value.indexOf(id)
  if (index >= 0) selectedTagIds.value.splice(index, 1)
  else selectedTagIds.value.push(id)
}

function toggleSelectCurrentPage() {
  const ids = pagedTags.value.filter(tag => !tag.isSystemTag).map(tagKey)
  if (ids.length === 0) return
  if (ids.every(id => selectedTagIds.value.includes(id))) {
    selectedTagIds.value = selectedTagIds.value.filter(id => !ids.includes(id))
  } else {
    selectedTagIds.value = [...new Set([...selectedTagIds.value, ...ids])]
  }
}

function selectedTagObjects() {
  return selectedTagIds.value
    .map(id => allTags.value.find(tag => tagKey(tag) === id))
    .filter(Boolean)
}

async function setSelectedTagsPublic() {
  const selected = selectedTagObjects()
  if (selected.length === 0) return
  try {
    for (const tag of selected) {
      const isUserTag = !!tag.isUserTag || /^u\d+$/i.test(String(tag.id))
      const tagId = isUserTag ? parseInt(tagKey(tag).slice(1), 10) : Number(tag.id)
      await api.post('/api/admin/tag-convert/toggle', { tagId, isUserTag, is_public: true })
    }
    selectedTagIds.value = []
    await fetchAdminTags()
    showAdminToast('已设为公共', 'success')
  } catch (err) {
    showAdminToast('批量设为公共失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function deleteSelectedTags() {
  const selected = selectedTagObjects()
  if (selected.length === 0) return
  openDeleteDialog({
    type: 'selected-tags',
    payload: selected,
    title: '确认删除标签',
    message: `删除选中的 ${selected.length} 个标签？`,
    effects: ['关联的图片标签会同步清除', '删除后标签列表不可直接恢复'],
  })
}

async function deleteSelectedTagsNow(selected) {
  try {
    for (const tag of selected) {
      await deleteTagRequest(tag)
    }
    selectedTagIds.value = []
    await fetchAdminTags()
    showAdminToast('选中标签已删除', 'success')
  } catch (err) {
    showAdminToast('批量删除失败: ' + (err.data?.error || err.message), 'error')
  }
}

function openAddTag() {
  editingTag.value = null
  tagForm.name = ''
  tagForm.display_name = ''
  tagForm.combinable = true
  tagForm.is_public = true
  tagForm.mutually_exclusive_with = ''
  showTagModal.value = true
}

function openEditTag(tag) {
  editingTag.value = tag
  tagForm.name = tag.name || ''
  tagForm.display_name = tag.display_name || ''
  tagForm.combinable = tag.combinable !== false
  tagForm.is_public = tag.is_public !== false
  tagForm.mutually_exclusive_with = tag.mutually_exclusive_with || ''
  showTagModal.value = true
}

function closeTagModal() {
  showTagModal.value = false
  editingTag.value = null
}

function parseMutualInput(value) {
  if (!value) return []
  return String(value)
    .split(/[,，.。\s]+/)
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => /^u\d+$/i.test(id) ? `u${parseInt(id.slice(1), 10)}` : (/^\d+$/.test(id) ? Number(id) : null))
    .filter(id => id !== null)
}

function stringifyMutualInput(ids) {
  const seen = new Set()
  const normalized = []
  for (const id of ids) {
    const value = /^u\d+$/i.test(String(id)) ? `u${parseInt(String(id).slice(1), 10)}` : Number(id)
    if ((typeof value === 'number' && !Number.isInteger(value)) || seen.has(String(value))) continue
    seen.add(String(value))
    normalized.push(value)
  }
  return normalized.join(',')
}

function normalizeMutualList(value, selfId, validIds) {
  const selfKey = normalizeTagId(selfId)
  return parseMutualInput(value).filter(id => normalizeTagId(id) !== selfKey && validIds.has(normalizeTagId(id)))
}

function applyMutualPairs(all, editedId) {
  const tagNodes = all.filter(tag => !tag.isSystemTag && !tag.isPublicUserTag && (typeof tag.id === 'number' || tag.isUserTag || /^u\d+$/i.test(String(tag.id))))
  const byKey = new Map(tagNodes.map(tag => [tagKey(tag), tag]))
  const validIds = new Set(tagNodes.map(tag => tagKey(tag)))
  const editedKey = normalizeTagId(editedId)
  const editedTag = byKey.get(editedKey)

  if (editedTag && editedTag.combinable !== false && normalizeMutualList(editedTag.mutually_exclusive_with, editedTag.id, validIds).length === 0) {
    for (const tag of tagNodes) {
      if (tagKey(tag) === editedKey) continue
      tag.mutually_exclusive_with = stringifyMutualInput(
        normalizeMutualList(tag.mutually_exclusive_with, tag.id, validIds).filter(id => normalizeTagId(id) !== editedKey)
      )
    }
  }

  const adjacency = new Map(tagNodes.map(tag => [tagKey(tag), new Set()]))
  for (const tag of tagNodes) {
    const key = tagKey(tag)
    const mutualIds = normalizeMutualList(tag.mutually_exclusive_with, tag.id, validIds)
    for (const targetId of mutualIds) {
      const targetKey = normalizeTagId(targetId)
      if (!byKey.has(targetKey)) continue
      adjacency.get(key).add(targetKey)
      adjacency.get(targetKey).add(key)
    }
  }

  const visited = new Set()
  for (const tag of tagNodes) {
    const startKey = tagKey(tag)
    if (visited.has(startKey)) continue
    const stack = [startKey]
    const component = []
    visited.add(startKey)
    while (stack.length > 0) {
      const currentKey = stack.pop()
      component.push(currentKey)
      for (const nextKey of adjacency.get(currentKey) || []) {
        if (visited.has(nextKey)) continue
        visited.add(nextKey)
        stack.push(nextKey)
      }
    }
    const sorted = [...component].sort((a, b) => {
      const au = a.startsWith('u')
      const bu = b.startsWith('u')
      if (au !== bu) return au ? 1 : -1
      return parseInt(a.replace(/^u/, ''), 10) - parseInt(b.replace(/^u/, ''), 10)
    })
    for (const memberKey of component) {
      const member = byKey.get(memberKey)
      const nextIds = sorted.filter(key => key !== memberKey).map(key => key.startsWith('u') ? key : Number(key))
      member.mutually_exclusive_with = stringifyMutualInput(nextIds)
      if (nextIds.length > 0) member.combinable = false
    }
  }
}

function validateTagForm() {
  if (!tagForm.name.trim()) {
    showAdminToast('请输入标签名称', 'error')
    return false
  }
  if (!tagForm.display_name.trim()) {
    showAdminToast('请输入显示名', 'error')
    return false
  }
  return true
}

async function saveTag() {
  if (!validateTagForm()) return
  try {
    const currentTags = JSON.parse(JSON.stringify(tags.value || { combinable: [], nonCombinable: [] }))
    currentTags.combinable = (currentTags.combinable || []).filter(tag => !tag.isSystemTag && !tag.isPublicUserTag)
    currentTags.nonCombinable = (currentTags.nonCombinable || []).filter(tag => !tag.isSystemTag && !tag.isPublicUserTag)

    if (editingTag.value?.isUserTag || /^u\d+$/i.test(String(editingTag.value?.id || ''))) {
      const userTagId = parseInt(tagKey(editingTag.value).slice(1), 10)
      await api.put(`/api/user-tags/${userTagId}`, {
        name: tagForm.name.trim(),
        display_name: tagForm.display_name.trim(),
        combinable: tagForm.combinable,
        is_public: tagForm.is_public,
        mutually_exclusive_with: tagForm.mutually_exclusive_with
      })
    } else {
      const all = [...currentTags.combinable, ...currentTags.nonCombinable]
      let savedTagId = editingTag.value?.id || null
      if (editingTag.value) {
        const found = all.find(tag => String(tag.id) === String(editingTag.value.id))
        if (found) {
          found.name = tagForm.name.trim()
          found.display_name = tagForm.display_name.trim()
          found.combinable = tagForm.combinable
          found.is_public = tagForm.is_public
          found.mutually_exclusive_with = tagForm.mutually_exclusive_with
        }
      } else {
        const duplicate = all.find(tag => String(tag.name || '').toLowerCase() === tagForm.name.trim().toLowerCase())
        if (duplicate) return showAdminToast(`公共标签名「${tagForm.name.trim()}」已存在，请换一个名称`, 'error')
        const maxId = all.reduce((max, tag) => Math.max(max, typeof tag.id === 'number' ? tag.id : 0), 0)
        const newId = Math.max(maxId + 1, currentTags.nextId || 1)
        currentTags.nextId = newId + 1
        savedTagId = newId
        all.push({
          id: newId,
          name: tagForm.name.trim(),
          display_name: tagForm.display_name.trim(),
          combinable: tagForm.combinable,
          mutually_exclusive_with: tagForm.mutually_exclusive_with,
          is_public: tagForm.is_public
        })
      }
      applyMutualPairs(all, savedTagId)
      currentTags.combinable = all.filter(tag => tag.combinable !== false)
      currentTags.nonCombinable = all.filter(tag => tag.combinable === false)
      await api.post('/api/admin/tags', currentTags)
    }

    await fetchAdminTags()
    closeTagModal()
    showAdminToast('标签已保存', 'success')
  } catch (err) {
    showAdminToast('操作失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function deleteTagRequest(tag) {
  if (tag.isSystemTag) return
  if (tag.isUserTag || /^u\d+$/i.test(String(tag.id))) {
    await api.del(`/api/user-tags/${parseInt(tagKey(tag).slice(1), 10)}`)
  } else {
    await api.del(`/api/admin/tags/${tag.id}`)
  }
}

async function deleteTag(tag) {
  openDeleteDialog({
    type: 'tag',
    payload: tag,
    title: '确认删除标签',
    message: `删除标签 "${tag.display_name || tag.name}"？`,
    effects: ['关联的图片标签会同步清除', '删除后该标签不可直接恢复'],
  })
}

async function deleteTagNow(tag) {
  try {
    await deleteTagRequest(tag)
    await fetchAdminTags()
    showAdminToast('标签已删除', 'success')
  } catch (err) {
    showAdminToast('删除失败: ' + (err.data?.error || err.message), 'error')
  }
}

function groupKey(group) {
  return `group-${group.id}`
}

function toggleGroupExpand(key) {
  const index = expandedGroups.value.indexOf(key)
  if (index >= 0) expandedGroups.value.splice(index, 1)
  else expandedGroups.value.push(key)
}

function groupTagCount(group) {
  const ids = new Set((group.tagIds || []).map(normalizeTagId))
  for (const sg of group.subgroups || []) {
    for (const id of sg.tagIds || []) ids.add(normalizeTagId(id))
  }
  return ids.size
}

function subgroupTagCount(subgroup) {
  return new Set((subgroup.tagIds || []).map(normalizeTagId)).size
}

function openCreateGroup() {
  groupModalMode.value = 'create-group'
  editingGroup.value = null
  editingSubgroup.value = null
  parentGroup.value = null
  groupForm.name = ''
  groupForm.tagIds = []
  showGroupModal.value = true
}

function openEditGroup(group) {
  groupModalMode.value = 'edit-group'
  editingGroup.value = group
  editingSubgroup.value = null
  parentGroup.value = null
  groupForm.name = group.name || ''
  groupForm.tagIds = (group.tagIds || []).map(normalizeTagId)
  showGroupModal.value = true
}

function openCreateSubgroup(group) {
  groupModalMode.value = 'create-subgroup'
  parentGroup.value = group
  editingGroup.value = null
  editingSubgroup.value = null
  groupForm.name = ''
  groupForm.tagIds = []
  showGroupModal.value = true
}

function openEditSubgroup(group, subgroup) {
  groupModalMode.value = 'edit-subgroup'
  parentGroup.value = group
  editingGroup.value = null
  editingSubgroup.value = subgroup
  groupForm.name = subgroup.name || ''
  groupForm.tagIds = (subgroup.tagIds || []).map(normalizeTagId)
  showGroupModal.value = true
}

function closeGroupModal() {
  showGroupModal.value = false
  editingGroup.value = null
  editingSubgroup.value = null
  parentGroup.value = null
  groupForm.name = ''
  groupForm.tagIds = []
}

function toggleGroupTag(id) {
  const normalized = normalizeTagId(id)
  const index = groupForm.tagIds.indexOf(normalized)
  if (index >= 0) groupForm.tagIds.splice(index, 1)
  else groupForm.tagIds.push(normalized)
}

async function saveGroupModal() {
  if (!groupForm.name.trim()) return showAdminToast('请输入分组名称', 'error')
  try {
    if (groupModalMode.value === 'create-group') {
      await api.post('/api/admin/tag-groups', { name: groupForm.name.trim() })
    } else if (groupModalMode.value === 'edit-group') {
      await api.put(`/api/admin/tag-groups/${editingGroup.value.id}`, { name: groupForm.name.trim(), tagIds: groupForm.tagIds })
    } else if (groupModalMode.value === 'create-subgroup') {
      const subgroup = await api.post(`/api/admin/tag-groups/${parentGroup.value.id}/subgroup`, { name: groupForm.name.trim() })
      if (groupForm.tagIds.length > 0) {
        await api.put(`/api/admin/tag-groups/${parentGroup.value.id}/subgroup/${subgroup.sid}`, { tagIds: groupForm.tagIds })
      }
    } else if (groupModalMode.value === 'edit-subgroup') {
      await api.put(`/api/admin/tag-groups/${parentGroup.value.id}/subgroup/${editingSubgroup.value.sid}`, {
        name: groupForm.name.trim(),
        tagIds: groupForm.tagIds
      })
    }
    await loadGroups()
    closeGroupModal()
    showAdminToast('分组已保存', 'success')
  } catch (err) {
    showAdminToast('保存分组失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function deleteGroup(group) {
  openDeleteDialog({
    type: 'group',
    payload: group,
    title: '确认删除分组',
    message: `删除分组 "${group.name}"？`,
    effects: ['仅删除分组结构，不删除标签本身', '分组内子分组关系会同步移除'],
  })
}

async function deleteGroupNow(group) {
  try {
    await api.del(`/api/admin/tag-groups/${group.id}`)
    await loadGroups()
    showAdminToast('分组已删除', 'success')
  } catch (err) {
    showAdminToast('删除失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function deleteSubgroup(group, subgroup) {
  openDeleteDialog({
    type: 'subgroup',
    payload: { group, subgroup },
    title: '确认删除子分组',
    message: `删除子分组 "${subgroup.name}"？`,
    effects: ['仅删除子分组结构，不删除标签本身'],
  })
}

async function deleteSubgroupNow(group, subgroup) {
  try {
    await api.del(`/api/admin/tag-groups/${group.id}/subgroup/${subgroup.sid}`)
    await loadGroups()
    showAdminToast('子分组已删除', 'success')
  } catch (err) {
    showAdminToast('删除失败: ' + (err.data?.error || err.message), 'error')
  }
}

function openDeleteDialog(options) {
  deleteDialog.show = true
  deleteDialog.type = options.type
  deleteDialog.payload = options.payload
  deleteDialog.title = options.title
  deleteDialog.message = options.message
  deleteDialog.description = options.description || '此操作不可恢复，请谨慎操作。'
  deleteDialog.effects = options.effects || []
}

function closeDeleteDialog() {
  if (deleteDialog.loading) return
  deleteDialog.show = false
  deleteDialog.type = ''
  deleteDialog.payload = null
  deleteDialog.effects = []
}

async function confirmDeleteDialog() {
  if (deleteDialog.loading) return
  deleteDialog.loading = true
  try {
    if (deleteDialog.type === 'selected-tags') await deleteSelectedTagsNow(deleteDialog.payload || [])
    else if (deleteDialog.type === 'tag') await deleteTagNow(deleteDialog.payload)
    else if (deleteDialog.type === 'group') await deleteGroupNow(deleteDialog.payload)
    else if (deleteDialog.type === 'subgroup') await deleteSubgroupNow(deleteDialog.payload.group, deleteDialog.payload.subgroup)
    deleteDialog.loading = false
    closeDeleteDialog()
  } finally {
    deleteDialog.loading = false
  }
}

function manualScopeParams() {
  const params = {}
  if (manualSource.value === 'public') params.public = 'true'
  else if (manualSource.value === 'mine') params.mine = 'true'
  else if (manualSource.value === 'user' && manualUserId.value) params.userId = manualUserId.value
  return params
}

async function loadManualAlbums() {
  if (manualSource.value === 'user' && !manualUserId.value) {
    albums.value = []
    return
  }
  try {
    const data = await api.get('/api/internal/albums', { limit: 500, ...manualScopeParams() })
    albums.value = data.albums || []
    if (manualAlbum.value && !albums.value.some(album => String(album.id) === String(manualAlbum.value))) {
      manualAlbum.value = null
    }
  } catch {
    albums.value = []
  }
}

async function loadManualImages(targetPage = 1) {
  manualPage.value = Number(targetPage) || 1
  manualSelected.value = []
  if (manualSource.value === 'user' && !manualUserId.value) {
    manualImages.value = []
    manualTotal.value = 0
    return
  }
  try {
    const data = await api.get('/api/internal/images', {
      page: manualPage.value,
      limit: manualPageSize.value,
      sort: manualSort.value,
      order: 'desc',
      album: manualAlbum.value || undefined,
      ...manualScopeParams()
    })
    manualImages.value = data.images || []
    manualTotal.value = Number(data.total || 0)
  } catch {
    manualImages.value = []
    manualTotal.value = 0
  }
}

async function reloadManualContext() {
  manualAlbum.value = null
  manualSelected.value = []
  manualTagIds.value = []
  manualNewTagNames.value = []
  await loadManualAlbums()
  await loadManualImages(1)
}

async function switchManualSource() {
  if (manualSource.value !== 'user') manualUserId.value = null
  await reloadManualContext()
}

function toggleManualSelect(id) {
  const index = manualSelected.value.indexOf(id)
  if (index >= 0) manualSelected.value.splice(index, 1)
  else manualSelected.value.push(id)
}

function showManualPreview(img, targetEl) {
  manualPreviewRef.value?.show(img, targetEl)
}

function hideManualPreview() {
  manualPreviewRef.value?.hide()
}

function getThumbUrl(img) {
  const url = img.medium_url || img.thumb_url || img.url
  return url ? `${config.public.apiBase || ''}${url}` : ''
}

function toggleManualGroup(key) {
  const index = manualExpandedGroups.value.indexOf(key)
  if (index >= 0) manualExpandedGroups.value.splice(index, 1)
  else manualExpandedGroups.value.push(key)
}

function toggleManualTag(tag) {
  const id = tagKey(tag)
  const index = manualTagIds.value.indexOf(id)
  if (index >= 0) manualTagIds.value.splice(index, 1)
  else manualTagIds.value.push(id)
}

function addManualDraftTag() {
  const label = manualTagDraft.value.trim()
  if (!label) return
  const existing = manualSelectableTags.value.find(tag => [tag.name, tag.display_name].filter(Boolean).some(value => String(value).toLowerCase() === label.toLowerCase()))
  if (existing) {
    const id = tagKey(existing)
    if (!manualTagIds.value.includes(id)) manualTagIds.value.push(id)
  } else if (!manualNewTagNames.value.some(name => name.toLowerCase() === label.toLowerCase())) {
    manualNewTagNames.value.push(label)
  }
  manualTagDraft.value = ''
}

function removeManualTag(tag) {
  if (tag.type === 'new') {
    manualNewTagNames.value = manualNewTagNames.value.filter(name => `new:${name}` !== tag.key)
  } else {
    manualTagIds.value = manualTagIds.value.filter(id => id !== tag.key)
  }
}

function clearManualTags() {
  manualTagIds.value = []
  manualNewTagNames.value = []
  manualTagDraft.value = ''
}

async function runManualTag() {
  if (manualSelected.value.length === 0) return showAdminToast('请选择图片', 'error')
  if (manualSelectedTagChips.value.length === 0) return showAdminToast('请选择或输入标签', 'error')
  if (manualSource.value === 'user' && !manualUserId.value) return showAdminToast('请先选择用户', 'error')
  manualLoading.value = true
  try {
    const payload = {
      imageIds: manualSelected.value,
      tagIds: manualTagIds.value,
      newTagNames: manualNewTagNames.value,
      overwrite: manualOverwrite.value
    }
    const data = await api.post('/api/admin/tags/run/manual', payload)
    showAdminToast(data.message || '人工标签完成', 'success')
    manualSelected.value = []
    clearManualTags()
    await fetchAdminTags()
    await loadManualImages(manualPage.value)
  } catch (err) {
    showAdminToast('执行失败: ' + (err.data?.error || err.message), 'error')
  } finally {
    manualLoading.value = false
  }
}

function buildPageItems(current, total) {
  const safeTotal = Math.max(1, Number(total) || 1)
  const safeCurrent = Math.min(Math.max(1, Number(current) || 1), safeTotal)
  if (safeTotal <= 6) {
    return Array.from({ length: safeTotal }, (_, index) => ({ key: `p-${index + 1}`, page: index + 1, label: String(index + 1) }))
  }
  const pages = new Set([1, safeTotal, safeCurrent, safeCurrent - 1, safeCurrent + 1, 2, 3, 4])
  const ordered = [...pages].filter(page => page >= 1 && page <= safeTotal).sort((a, b) => a - b)
  const items = []
  for (let index = 0; index < ordered.length; index += 1) {
    const page = ordered[index]
    if (index > 0 && page - ordered[index - 1] > 1) {
      items.push({ key: `e-${ordered[index - 1]}-${page}`, ellipsis: true, label: '...' })
    }
    items.push({ key: `p-${page}`, page, label: String(page) })
  }
  return items
}
</script>

<style scoped>
.admin-tags-page {
  position: relative;
  min-height: calc(100vh - 96px);
  padding: 2px 0 18px;
  color: #5f6b82;
}

.admin-tags-page::before {
  content: '';
  position: fixed;
  inset: 64px 0 0 220px;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 8%, rgba(177, 229, 255, 0.42), transparent 30%),
    radial-gradient(circle at 92% 5%, rgba(255, 190, 216, 0.34), transparent 30%),
    linear-gradient(135deg, rgba(248, 251, 255, 0.94), rgba(255, 249, 253, 0.88) 52%, rgba(246, 251, 255, 0.94));
}

.tags-frame {
  min-height: calc(100vh - 126px);
  display: grid;
  grid-template-rows: 54px minmax(0, 1fr);
  border: 1px solid rgba(224, 229, 240, 0.72);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 18px 42px rgba(79, 92, 124, 0.08);
  backdrop-filter: blur(22px) saturate(1.08);
  overflow: hidden;
}

.tags-tabs {
  display: flex;
  align-items: flex-end;
  gap: 36px;
  padding: 0 28px;
  border-bottom: 1px solid rgba(224, 229, 240, 0.72);
}

.tags-tabs button {
  position: relative;
  height: 54px;
  border: none;
  background: transparent;
  color: #8590a8;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
}

.tags-tabs button:hover {
  color: #000000;
}

.tags-tabs button.active {
  color: #f54c73;
}

.tags-tabs button.active::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 0;
  height: 4px;
  border-radius: 999px;
  background: #f54c73;
}

.manage-grid,
.manual-grid {
  min-height: 0;
  display: grid;
  gap: 18px;
  padding: 18px;
}

.manage-grid {
  grid-template-columns: minmax(0, 1fr) 318px;
}

.manual-grid {
  grid-template-columns: minmax(0, 1fr) 368px;
  align-items: start;
}

.glass-card {
  border: 1px solid rgba(224, 229, 240, 0.72);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 16px 36px rgba(82, 92, 122, 0.08);
  backdrop-filter: blur(20px);
}

.tag-list-card {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: 56px 48px minmax(0, 1fr) 54px;
}

.tag-card-header,
.group-card-header,
.manual-title,
.manual-select-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.tag-card-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  padding: 0 18px;
  border-bottom: 1px solid rgba(224, 229, 240, 0.64);
}

h2,
h3 {
  margin: 0;
  color: #303a51;
  font-weight: 900;
  letter-spacing: 0;
}

h2 {
  font-size: 16px;
}

h3 {
  font-size: 15px;
}

.tag-toolbar {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(150px, 260px) minmax(96px, 112px) max-content;
  align-items: center;
  justify-content: end;
  gap: 10px;
}

.tag-toolbar .soft-select {
  width: 100%;
  min-width: 0;
}

.search-box {
  width: 100%;
  min-width: 0;
  height: 34px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid rgba(218, 224, 238, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.search-box .taotu-svg-icon {
  width: 15px;
  height: 15px;
  opacity: 0.68;
}

.search-box input,
.modal-field input,
.manual-tag-input {
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #657188;
  font-size: 13px;
  font-weight: 850;
}

.soft-select,
.page-size-select,
.manual-filters select {
  height: 34px;
  min-width: 112px;
  padding: 0 34px 0 12px;
  border: 1px solid rgba(218, 224, 238, 0.9);
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.74);
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-repeat: no-repeat;
  background-position: calc(100% - 17px) 50%, calc(100% - 11px) 50%;
  background-size: 6px 6px, 6px 6px;
  color: #657188;
  font-size: 13px;
  font-weight: 900;
  outline: none;
  appearance: none;
}

.primary-action,
.outline-action,
.save-btn,
.run-manual-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 8px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}

.primary-action {
  height: 34px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: linear-gradient(90deg, #ff6b9e, #ff78aa);
  color: white;
  box-shadow: 0 12px 24px rgba(255, 110, 158, 0.2);
}

.primary-action .taotu-svg-icon,
.outline-action .taotu-svg-icon,
.bulk-btn .taotu-svg-icon,
.run-manual-btn .taotu-svg-icon,
.add-subgroup-btn .taotu-svg-icon {
  width: 15px;
  height: 15px;
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(224, 229, 240, 0.64);
}

.bulk-actions strong {
  color: #ff6f9d;
  font-size: 12px;
  font-weight: 900;
}

.bulk-btn {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.bulk-btn.purple {
  border: 1px solid rgba(155, 126, 245, 0.22);
  background: rgba(246, 242, 255, 0.9);
  color: #8d74eb;
}

.bulk-btn.danger {
  border: 1px solid rgba(255, 111, 157, 0.24);
  background: rgba(255, 241, 246, 0.92);
  color: #ff6f9d;
}

.bulk-btn:disabled,
.run-manual-btn:disabled {
  opacity: 0.52;
  cursor: default;
}

.tag-table-shell {
  min-height: 0;
  display: grid;
  grid-template-rows: 46px minmax(0, 1fr);
}

.tag-table-head,
.tag-table-row {
  display: grid;
  grid-template-columns: 38px 92px minmax(135px, 1.08fr) minmax(140px, 1fr) 112px 126px 110px;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
}

.tag-table-head {
  color: #8792a8;
  font-size: 12px;
  font-weight: 900;
  background: rgba(248, 250, 254, 0.74);
  border-bottom: 1px solid rgba(224, 229, 240, 0.72);
}

.tag-table-body {
  min-height: 0;
  overflow-y: auto;
}

.tag-table-row {
  min-height: 50px;
  border-bottom: 1px solid rgba(224, 229, 240, 0.62);
  color: #66728a;
  font-size: 12px;
  font-weight: 850;
}

.tag-id {
  color: #7f8ba3;
  font-weight: 900;
}

.row-actions {
  display: flex;
  gap: 12px;
}

.text-action {
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.text-action.edit {
  color: #8d74eb;
}

.text-action.delete {
  color: #ff6f9d;
}

.text-action:disabled {
  opacity: 0.42;
  cursor: default;
}

.empty-line,
.manual-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  color: #9aa5b8;
  font-size: 13px;
  font-weight: 900;
}

.tag-pagination,
.manual-pagination {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  color: #8792a8;
  font-size: 13px;
  font-weight: 900;
}

.tag-pagination {
  justify-content: space-between;
  border-top: 1px solid rgba(224, 229, 240, 0.64);
}

.pager {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.pager button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(224, 229, 240, 0.86);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.68);
  color: #8792a8;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.pager button.active {
  border-color: rgba(255, 111, 157, 0.42);
  background: rgba(255, 241, 247, 0.88);
  color: #ff6f9d;
}

.pager button.ellipsis {
  border-color: transparent;
  background: transparent;
}

.pager button:disabled {
  opacity: 0.46;
  cursor: default;
}

.pager .taotu-svg-icon {
  width: 15px;
  height: 15px;
}

.page-size-select {
  min-width: 92px;
}

.soft-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.soft-checkbox input {
  display: none;
}

.soft-checkbox .taotu-checkbox-icon-pair {
  --checkbox-icon-size: 20px;
  --checkbox-icon-color: rgba(214, 222, 236, 0.98);
  --checkbox-checked-color: #ff79aa;
}

.soft-checkbox.mini .taotu-checkbox-icon-pair {
  --checkbox-icon-size: 20px;
}

.group-card {
  min-height: 0;
  display: grid;
  grid-template-rows: 58px minmax(0, 1fr);
}

.group-card-header {
  padding: 0 14px 0 16px;
  border-bottom: 1px solid rgba(224, 229, 240, 0.64);
}

.outline-action {
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(255, 111, 157, 0.25);
  background: rgba(255, 255, 255, 0.62);
  color: #ff6f9d;
  font-size: 13px;
}

.group-tree {
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}

.group-section {
  margin-top: 10px;
  border: 1px solid rgba(224, 229, 240, 0.72);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.4);
  overflow: hidden;
}

.group-node,
.sub-node {
  min-height: 34px;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto 56px;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  color: #657188;
  font-size: 13px;
  font-weight: 900;
}

.group-node.active {
  border-radius: 8px;
  background: rgba(255, 235, 243, 0.92);
  color: #ff6f9d;
}

.group-node.clickable {
  cursor: pointer;
}

.chevron-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  align-self: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.chevron-icon .taotu-svg-icon {
  width: 14px;
  height: 14px;
  display: block;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  transition: transform 0.16s ease;
}

.chevron-icon.expanded .taotu-svg-icon {
  transform: rotate(0deg);
}

.group-node em,
.sub-node em {
  color: #a1abba;
  font-style: normal;
  font-size: 12px;
}

.group-node-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.group-node-actions button {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  cursor: pointer;
}

.group-node-actions .taotu-svg-icon {
  width: 15px;
  height: 15px;
}

.group-node-actions button:disabled {
  opacity: 0.34;
  cursor: default;
}

.sub-tree {
  margin: 2px 0 10px 24px;
  border-left: 1px solid rgba(215, 222, 235, 0.92);
}

.sub-node {
  grid-template-columns: 16px minmax(0, 1fr) auto 56px;
  padding-left: 10px;
  color: #7b879d;
}

.sub-node > i {
  width: 16px;
  height: 1px;
  background: rgba(215, 222, 235, 0.92);
}

.manual-images-card {
  min-width: 0;
  min-height: 0;
  align-self: start;
  display: grid;
  grid-template-rows: auto auto auto auto 52px;
  padding: 18px;
}

.manual-title {
  justify-content: flex-start;
  gap: 16px;
}

.manual-title p {
  margin: 0;
  color: #9aa5b8;
  font-size: 12px;
  font-weight: 900;
}

.manual-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 22px;
  margin-top: 20px;
}

.manual-filters label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  color: #657188;
  font-size: 13px;
  font-weight: 900;
}

.manual-filters label.disabled {
  opacity: 0.62;
}

.manual-filters select {
  width: 100%;
}

.manual-select-line {
  margin: 18px 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: #6a758d;
  font-size: 13px;
  font-weight: 900;
}

.manual-hover-tip {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 0 0 auto;
  color: #a27791;
  font-size: 12px;
  white-space: nowrap;
}

.manual-hover-tip .taotu-svg-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.manual-image-grid {
  max-height: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  align-content: start;
  justify-content: stretch;
  overflow-y: auto;
  padding-right: 4px;
}

.manual-image {
  position: relative;
  width: 100%;
  height: auto;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 1.72 / 1;
  border: 2px solid transparent;
  border-radius: 8px;
  background: rgba(246, 248, 252, 0.74);
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(88, 100, 130, 0.06);
}

.manual-image img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.manual-image.selected {
  border-color: #ff6f9d;
}

.manual-check-mark {
  position: absolute;
  top: 0;
  right: 0;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-bottom-left-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  padding: 3px;
}

.manual-check-mark .taotu-svg-icon {
  width: 100%;
  height: 100%;
  display: block;
}

.manual-pagination {
  justify-content: space-between;
  padding: 12px 0 0;
}

.manual-side {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 170px;
  gap: 14px;
}

.manual-select-card,
.manual-execute-card {
  padding: 16px 18px;
}

.manual-select-card {
  min-height: 0;
  display: grid;
  grid-template-rows: auto 36px 24px auto minmax(0, 1fr);
  gap: 12px;
}

.manual-select-card header button {
  border: none;
  background: transparent;
  color: #a0aabc;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.manual-select-card h3 span {
  color: #9aa5b8;
  font-size: 13px;
}

.manual-tag-input {
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(218, 224, 238, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.manual-select-card p {
  margin: 0;
  color: #8792a8;
  font-size: 12px;
  font-weight: 900;
}

.selected-tag-box {
  min-height: 38px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(224, 229, 240, 0.76);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.42);
}

.selected-tag-box button,
.manual-tree-content button {
  min-height: 24px;
  border: 1px solid rgba(255, 111, 157, 0.24);
  border-radius: 999px;
  background: rgba(255, 241, 247, 0.86);
  color: #ff6f9d;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.selected-tag-box button {
  padding: 0 9px;
}

.selected-tag-box i {
  font-style: normal;
}

.empty-chip {
  color: #a0aabc;
  font-size: 12px;
  font-weight: 900;
}

.manual-tag-tree {
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.manual-tree-group {
  border-bottom: 1px solid rgba(224, 229, 240, 0.52);
  padding: 6px 0;
}

.manual-tree-title {
  width: 100%;
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: none;
  background: transparent;
  color: #647088;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  text-align: left;
}

.manual-tree-title.child {
  color: #7a869c;
  font-size: 12px;
}

.manual-chevron {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  flex: 0 0 16px;
}

.manual-chevron .taotu-svg-icon {
  width: 13px;
  height: 13px;
  display: block;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  transition: transform 0.16s ease;
}

.manual-chevron.expanded .taotu-svg-icon {
  transform: rotate(0deg);
}

.manual-tree-title em {
  color: #a2abbc;
  font-style: normal;
  font-size: 12px;
}

.manual-tree-content {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 6px 0 6px 23px;
}

.manual-tree-content.child {
  padding-left: 40px;
}

.manual-tree-content button {
  padding: 0 10px;
  border-color: rgba(224, 229, 240, 0.7);
  background: rgba(255, 255, 255, 0.58);
  color: #77839a;
}

.manual-tree-content button.selected {
  border-color: rgba(255, 111, 157, 0.36);
  background: rgba(255, 235, 244, 0.95);
  color: #ff6f9d;
}

.manual-execute-card {
  display: grid;
  grid-template-rows: auto auto 52px auto;
  align-content: center;
  gap: 12px;
}

.execute-check {
  color: #303a51;
  font-size: 14px;
  font-weight: 900;
}

.execute-check span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.execute-check .taotu-svg-icon {
  width: 14px;
  height: 14px;
  color: #9aa5b8;
  flex: 0 0 auto;
}

.manual-execute-card p,
.manual-execute-card strong {
  margin: 0;
  text-align: center;
  color: #9aa5b8;
  font-size: 12px;
  font-weight: 900;
}

.run-manual-btn {
  min-height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: linear-gradient(90deg, #f79ac1, #f7a6cb);
  color: white;
  box-shadow: 0 14px 30px rgba(244, 125, 177, 0.18);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 360;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(52, 60, 78, 0.2);
  backdrop-filter: blur(8px);
}

.tag-modal {
  width: min(420px, 100%);
  padding: 20px;
  border: 1px solid rgba(224, 229, 240, 0.78);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 26px 70px rgba(69, 78, 102, 0.18);
  backdrop-filter: blur(22px);
}

.group-modal {
  width: min(520px, 100%);
}

.tag-modal header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.tag-modal header h2 {
  font-size: 16px;
}

.tag-modal header button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #8893a8;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
}

.modal-field,
.modal-toggle {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
  color: #647088;
  font-size: 13px;
  font-weight: 900;
}

.modal-field span i {
  color: #ff6f9d;
  font-style: normal;
}

.modal-field span b {
  color: #657188;
  font-weight: 900;
}

.modal-field > div {
  position: relative;
  min-height: 36px;
  display: flex;
  align-items: center;
  border: 1px solid rgba(218, 224, 238, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.modal-field input {
  width: 100%;
  height: 34px;
  padding: 0 54px 0 12px;
}

.modal-field em {
  position: absolute;
  right: 10px;
  color: #a5adbd;
  font-style: normal;
  font-size: 12px;
  font-weight: 900;
}

.modal-field small {
  color: #a0aabc;
  font-size: 12px;
  font-weight: 900;
}

.modal-toggle {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.pink-switch input {
  display: none;
}

.pink-switch i {
  position: relative;
  display: block;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: #d8ddea;
  cursor: pointer;
}

.pink-switch i::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 6px rgba(75, 86, 110, 0.25);
  transition: transform 0.16s ease;
}

.pink-switch input:checked + i {
  background: #ff76a7;
}

.pink-switch input:checked + i::after {
  transform: translateX(18px);
}

.tag-modal footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 22px;
}

.cancel-btn,
.save-btn {
  min-width: 84px;
  min-height: 34px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.cancel-btn {
  border: 1px solid rgba(224, 229, 240, 0.88);
  background: rgba(255, 255, 255, 0.72);
  color: #717c91;
}

.save-btn {
  border: 1px solid rgba(255, 255, 255, 0.46);
  background: linear-gradient(90deg, #ff6b9e, #ff77aa);
  color: white;
  box-shadow: 0 12px 26px rgba(255, 108, 158, 0.2);
}

.add-subgroup-btn {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-bottom: 14px;
  padding: 0 13px;
  border: 1px solid rgba(155, 126, 245, 0.24);
  border-radius: 8px;
  background: rgba(246, 242, 255, 0.9);
  color: #8d74eb;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.tag-picker {
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
  padding: 10px;
}

.tag-picker button {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid rgba(224, 229, 240, 0.76);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.64);
  color: #77839a;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.tag-picker button.selected {
  border-color: rgba(255, 111, 157, 0.34);
  background: rgba(255, 235, 244, 0.95);
  color: #ff6f9d;
}

.pretty-scroll {
  scrollbar-width: auto;
  scrollbar-color: rgba(255, 111, 157, 0.62) rgba(246, 248, 252, 0.84);
}

.pretty-scroll::-webkit-scrollbar {
  width: 10px;
}

.pretty-scroll::-webkit-scrollbar-track {
  background: rgba(246, 248, 252, 0.84);
  border-radius: 999px;
}

.pretty-scroll::-webkit-scrollbar-thumb {
  border: 2px solid rgba(246, 248, 252, 0.84);
  border-radius: 999px;
  background: rgba(255, 111, 157, 0.68);
}

@media (max-width: 1280px) {
  .manage-grid {
    grid-template-columns: minmax(0, 1fr) 292px;
  }

  .tag-card-header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .tag-toolbar {
    grid-template-columns: minmax(118px, 1fr) 96px max-content;
    gap: 8px;
  }

  .primary-action {
    padding: 0 12px;
  }

  .manual-grid {
    grid-template-columns: 1fr;
  }

  .manual-side {
    grid-template-columns: minmax(0, 1fr) 360px;
    grid-template-rows: none;
  }
}

@media (max-width: 1060px) {
  .manage-grid {
    grid-template-columns: 1fr;
  }

  .tag-card-header,
  .tag-toolbar,
  .manual-filters {
    grid-template-columns: 1fr;
  }

  .tag-card-header {
    grid-template-columns: 1fr;
    align-items: start;
    padding: 10px 18px;
  }

  .tag-list-card {
    grid-template-rows: auto 48px minmax(0, 1fr) 54px;
  }

  .tag-toolbar {
    justify-content: stretch;
  }

  .manual-side {
    grid-template-columns: 1fr;
  }
}
</style>
