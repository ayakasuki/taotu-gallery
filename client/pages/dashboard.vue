<template>
  <div class="dashboard-page page-container">
    <div class="dashboard-shell">
      <aside class="dashboard-sidebar">
        <div class="profile-block">
          <div class="avatar-mark">
            <img v-if="userAvatarUrl" :src="userAvatarUrl" alt="" />
            <span v-else>{{ userInitial }}</span>
          </div>
          <div class="profile-copy">
            <div class="profile-name-row">
              <h1>{{ user?.username || '用户' }}</h1>
              <span class="role-badge">{{ user?.role === 'admin' ? '管理员' : '普通用户' }}</span>
            </div>
            <div class="profile-meta" v-if="user">
              <span>UID: {{ user.id }}</span>
              <span class="meta-divider"></span>
              <span>注册时间: {{ formatDateOnly(user.created_at) }}</span>
            </div>
          </div>
        </div>
        <nav class="dashboard-nav">
          <button v-for="item in navItems" :key="item.key" class="nav-item" :class="{ active: activeSection === item.key }" @click="activeSection = item.key">
            <img :src="item.icon" class="taotu-icon taotu-icon-20" alt="" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <main class="dashboard-content">
        <section v-if="activeSection === 'overview'" class="panel-section">
          <div class="overview-top-panel">
            <div class="content-header dashboard-overview-title"><h2>概览</h2></div>
            <div class="stats-row">
              <div class="stat-card">
                <div class="stat-icon stat-icon-pink"><img src="/icons/dashboard/image-management-64x64.png" alt="" /></div>
                <div class="stat-copy">
                  <span class="stat-label">我的图片数量</span>
                  <strong class="stat-value">{{ formatCount(dashboardStats.images) }}</strong>
                  <small>总计 {{ formatCount(dashboardStats.images) }} 张</small>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-purple"><img src="/icons/dashboard/storage-96x96.png" alt="" /></div>
                <div class="stat-copy">
                  <span class="stat-label">当前页存储</span>
                  <strong class="stat-value">{{ splitSize(dashboardStats.storage).value }} <em>{{ splitSize(dashboardStats.storage).unit }}</em></strong>
                  <small>{{ quotaSummaryText }}</small>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-violet"><img src="/icons/dashboard/private-tags-96x96.png" alt="" /></div>
                <div class="stat-copy">
                  <span class="stat-label">私有标签数量</span>
                  <strong class="stat-value">{{ formatCount(dashboardStats.privateTags) }}</strong>
                  <small>仅统计自己的私有标签</small>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-orange"><img src="/icons/dashboard/albums-64x64.png" alt="" /></div>
                <div class="stat-copy">
                  <span class="stat-label">我的相册数量</span>
                  <strong class="stat-value">{{ formatCount(dashboardStats.albums) }}</strong>
                  <small>总计 {{ formatCount(dashboardStats.albums) }} 个</small>
                </div>
              </div>
            </div>

            <div class="quick-actions-panel">
              <h3>快捷操作</h3>
              <div class="quick-actions">
                <NuxtLink to="/upload" class="action-card action-upload">
                  <span class="action-icon"><img src="/icons/upload/upload-cloud-128x128.png" alt="" /></span>
                  <span class="action-text"><strong>上传图片</strong><small>支持拖拽或批量上传 JPG / PNG / WEBP</small></span>
                  <span class="action-arrow">›</span>
                </NuxtLink>
                <NuxtLink to="/api-docs" class="action-card action-api">
                  <span class="action-icon"><img src="/icons/upload/api-upload-64x64.png" alt="" /></span>
                  <span class="action-text"><strong>API 接口</strong><small>获取 API Token，开始调用数据接口</small></span>
                  <span class="action-arrow">›</span>
                </NuxtLink>
              </div>
            </div>
          </div>

          <div class="overview-main-grid">
            <div class="recent-panel">
              <div class="panel-title-row">
                <h3>最近上传</h3>
                <button class="view-all-btn" type="button" @click="activeSection = 'images'">查看全部</button>
              </div>
              <div v-if="recentUploads.length > 0" class="recent-grid">
                <NuxtLink v-for="img in recentUploads" :key="img.id" class="recent-card" :to="'/image/' + img.id">
                  <img :src="getThumbUrl(img)" :alt="img.filename" loading="lazy" />
                  <span>{{ formatRelativeTime(img.created_at) }}</span>
                </NuxtLink>
              </div>
              <div v-else class="recent-empty">
                <img src="/icons/empty/no-images-256x256.png" alt="" />
                <p>还没有上传图片</p>
              </div>
            </div>

            <div class="overview-side-stack">
              <div class="side-card storage-card">
                <h3>存储使用</h3>
                <div class="storage-content">
                  <div class="storage-ring" :style="storageRingStyle">
                    <div class="storage-ring-inner">
                      <strong>{{ storagePercentLabel }}</strong>
                      <span>已使用</span>
                    </div>
                  </div>
                  <div class="storage-legend">
                    <div><i class="legend-dot used"></i><span>已使用</span><strong>{{ formatSize(dashboardStats.storage) }}</strong></div>
                    <div><i class="legend-dot free"></i><span>可用</span><strong>{{ dashboardStats.quotaBytes > 0 ? formatSize(dashboardStats.availableBytes) : '不限' }}</strong></div>
                    <div><i class="legend-dot total"></i><span>总容量</span><strong>{{ dashboardStats.quotaBytes > 0 ? formatSize(dashboardStats.quotaBytes) : '不限' }}</strong></div>
                    <div><i class="legend-dot image"></i><span>图片文件</span><strong>{{ formatSize(dashboardStats.storage) }}</strong></div>
                  </div>
                </div>
                <div class="storage-progress-row">
                  <span>容量使用</span>
                  <strong>{{ dashboardStats.quotaBytes > 0 ? formatSize(dashboardStats.storage) + ' / ' + formatSize(dashboardStats.quotaBytes) : formatSize(dashboardStats.storage) + ' / 不限' }}</strong>
                </div>
                <div class="storage-progress"><span :style="storageProgressStyle"></span></div>
              </div>

              <div class="side-card account-summary-card">
                <h3>账号摘要</h3>
                <div class="summary-row">
                  <span>用户名</span>
                  <strong class="summary-user">{{ user?.username || '-' }}<span class="summary-avatar"><img v-if="userAvatarUrl" :src="userAvatarUrl" alt="" /><span v-else>{{ userInitial }}</span></span></strong>
                </div>
                <div class="summary-row"><span>用户等级</span><strong class="pink-text">{{ user?.role === 'admin' ? '管理员' : '普通用户' }}</strong></div>
                <div class="summary-row"><span>注册时间</span><strong>{{ formatDateOnly(user?.created_at) }}</strong></div>
                <div class="summary-row"><span>上次登录</span><strong>{{ formatDateTime(user?.last_login_at) }}</strong></div>
                <div class="summary-row"><span>登录设备</span><strong>{{ browserInfo.browser }} / {{ browserInfo.os }}</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeSection === 'images'" class="panel-section image-management-section">
          <div class="image-manage-header">
            <h2>图片管理</h2>
            <p>高效管理您的图片资源，支持批量操作与智能筛选</p>
          </div>

          <div class="image-filter-card">
            <div class="filter-field source-field">
              <span class="filter-label">来源</span>
              <button type="button" class="filter-static-select">
                <span>我的图库</span>
                <img src="/icons/nav/chevron-down-64x64.png" alt="" />
              </button>
            </div>
            <div class="filter-field album-field">
              <span class="filter-label">相册</span>
              <TaotuSelect v-model="imageAlbumId" class="image-filter-select" :options="myAlbumOptions" @change="loadMyImages(1)" />
            </div>
            <div class="filter-search">
              <img src="/icons/actions/search-64x64.png" alt="" />
              <input v-model="imageSearchDraft" type="text" placeholder="搜索文件名" @keyup.enter="applyImageSearch" />
            </div>
            <div class="filter-field tag-filter-field">
              <button type="button" class="filter-dropdown-btn" :class="{ active: showImageMoreFilters || imageFilterTagIds.length > 0 }" @click="showImageMoreFilters = !showImageMoreFilters">
                <img src="/icons/dashboard/tag-settings-64x64.png" alt="" />
                <span>{{ imageFilterTagIds.length > 0 ? `标签筛选 (${imageFilterTagIds.length})` : '标签筛选' }}</span>
                <img class="dropdown-caret" src="/icons/nav/chevron-down-64x64.png" alt="" />
              </button>
            </div>
            <button type="button" class="image-search-btn" @click="applyImageSearch">
              <img src="/icons/actions/search-64x64.png" alt="" />
              <span>搜索</span>
            </button>
          </div>

          <div v-if="showImageMoreFilters" class="tag-filter-panel">
            <TagSelector :tags="privateTagOptions" :selectedTagIds="imageFilterTagIds" @update:selectedTagIds="onImageFilterTagsChange" />
          </div>

          <div class="image-table-card">
            <div class="image-batch-row">
              <span>批量操作:</span>
              <button type="button" class="batch-action-btn public-btn" :disabled="selectedImageIds.length === 0" @click="batchSetMyImagesPublic(true)">
                <img src="/icons/status/public-64x64.png" alt="" />
                <span>设为公开</span>
              </button>
              <button type="button" class="batch-action-btn private-btn" :disabled="selectedImageIds.length === 0" @click="batchSetMyImagesPublic(false)">
                <img src="/icons/status/private-64x64.png" alt="" />
                <span>取消公开</span>
              </button>
              <button type="button" class="batch-action-btn danger-btn" :disabled="selectedImageIds.length === 0" @click="batchDeleteMyImages">
                <img src="/icons/actions/delete-64x64.png" alt="" />
                <span>批量删除</span>
              </button>
            </div>

            <div class="image-table-head">
              <label class="soft-checkbox">
                <input type="checkbox" :checked="allMyImagesSelected" :disabled="myImages.length === 0" @change="toggleSelectAllCurrentImages" />
                <span></span>
              </label>
              <span>缩略图</span>
              <span>文件名</span>
              <span>元信息</span>
              <span>标签摘要</span>
              <span>公开状态</span>
              <span>操作</span>
            </div>

            <div class="image-table-scroll" :class="{ empty: myImages.length === 0 }">
              <div v-for="img in myImages" :key="img.id" class="image-table-row" :class="{ selected: selectedImageIds.includes(img.id) }">
                <label class="soft-checkbox">
                  <input type="checkbox" :checked="selectedImageIds.includes(img.id)" @change="toggleImageSelect(img.id)" />
                  <span></span>
                </label>
                <div class="table-thumb"><img :src="getThumbUrl(img)" :alt="img.filename" loading="lazy" /></div>
                <div class="table-file">
                  <strong>{{ img.filename }}</strong>
                  <small>{{ formatViewCount(img.view_count) }} 浏览</small>
                </div>
                <div class="table-meta">
                  <span>{{ formatSize(img.size_bytes) }}</span>
                  <i></i>
                  <span>{{ img.width || '-' }}×{{ img.height || '-' }}</span>
                  <span class="meta-date">{{ formatDateMinute(img.created_at) }}</span>
                </div>
                <div class="table-tags" :class="{ single: normalizedImageTags(img).length <= 1, multiple: normalizedImageTags(img).length > 1 }">
                  <span v-for="tag in normalizedImageTags(img).slice(0, 4)" :key="tag.key" class="table-tag">{{ tag.label }}</span>
                  <span v-if="normalizedImageTags(img).length > 4" class="table-tag">+{{ normalizedImageTags(img).length - 4 }}</span>
                  <span v-if="normalizedImageTags(img).length === 0" class="no-tags">-</span>
                </div>
                <label class="status-toggle" :class="{ active: img.is_public }">
                  <input type="checkbox" :checked="img.is_public" @change="togglePublic(img)" />
                  <span class="switch-track"></span>
                  <strong>{{ img.is_public ? '公开' : '私有' }}</strong>
                </label>
                <div class="table-actions">
                  <button type="button" class="row-action-btn edit-action" @click="openImageEdit(img)">
                    <img src="/icons/actions/edit-64x64.png" alt="" />
                    <span>编辑</span>
                  </button>
                  <button type="button" class="row-action-btn delete-action" @click="deleteMyImage(img)">
                    <img src="/icons/actions/delete-64x64.png" alt="" />
                    <span>删除</span>
                  </button>
                </div>
              </div>
              <div v-if="myImages.length === 0 && !loading" class="empty-msg">暂无图片</div>
            </div>
          </div>

          <div class="image-pagination-card">
            <div class="pagination-total">共 {{ formatCount(myTotal) }} 项</div>
            <div class="page-nav">
              <button type="button" class="page-arrow" :disabled="myPage <= 1" @click="loadMyImages(myPage - 1)">‹</button>
              <button
                v-for="item in imagePageItems"
                :key="item.key"
                type="button"
                class="page-number"
                :class="{ active: item.page === myPage, ellipsis: item.ellipsis }"
                :disabled="item.ellipsis"
                @click="!item.ellipsis && loadMyImages(item.page)"
              >{{ item.label }}</button>
              <button type="button" class="page-arrow" :disabled="myPage >= imageTotalPages" @click="loadMyImages(myPage + 1)">›</button>
            </div>
            <div class="pagination-tools">
              <TaotuSelect v-model="imagePageSize" class="page-size-select" :options="imagePageSizeOptions" @change="onImagePageSizeChange" />
              <span>跳至</span>
              <input v-model.number="imageJumpPage" type="number" min="1" :max="imageTotalPages" @keyup.enter="jumpToImagePage" />
              <span>页</span>
            </div>
          </div>
        </section>

        <section v-if="activeSection === 'tags'" class="panel-section tag-settings-section">
          <div class="tag-dashboard-card tag-manage-card">
            <div class="tag-card-heading">
              <h2>标签管理</h2>
            </div>

            <div class="private-tags-panel">
              <div class="private-tags-toolbar">
                <div class="private-title">
                  <h3>私有标签列表</h3>
                  <span>仅在个人范围内使用，普通用户无法公共化</span>
                </div>
                <div class="private-actions">
                  <span class="private-selected-count">已选择 {{ selectedPrivateTagIds.length }} 项</span>
                  <button type="button" class="private-action-btn private-delete-btn" :disabled="selectedPrivateTagIds.length === 0" @click="deleteSelectedPrivateTags">
                    <img src="/icons/actions/delete-64x64.png" alt="" />
                    <span>批量删除</span>
                  </button>
                  <button type="button" class="private-action-btn private-create-btn" @click="openTagCreate">
                    <img src="/icons/actions/add-64x64.png" alt="" />
                    <span>新建标签</span>
                  </button>
                </div>
              </div>

              <div class="private-tags-table">
                <div class="private-tags-head">
                  <label class="soft-checkbox">
                    <input type="checkbox" :checked="allPrivateTagsSelected" :disabled="pagedPrivateTags.length === 0" @change="toggleSelectAllPrivateTags" />
                    <span></span>
                  </label>
                  <span>名称</span>
                  <span>显示名</span>
                  <span class="head-with-info">是否可组合<i title="开启后该标签可与其它私有标签同时应用；关闭后适合用于互斥分类。">i</i></span>
                  <span class="head-with-info">互斥标签<i title="互斥标签会成组互相排斥，选择其中一个时应避免同时选择同组其它标签。">i</i></span>
                  <span>操作</span>
                </div>
                <div class="private-tags-body">
                  <div v-for="tag in pagedPrivateTags" :key="tag.id" class="private-tags-row">
                    <label class="soft-checkbox">
                      <input type="checkbox" :checked="selectedPrivateTagIds.includes(tag.id)" @change="togglePrivateTagSelect(tag.id)" />
                      <span></span>
                    </label>
                    <span class="private-name">{{ tag.name }}</span>
                    <span class="private-display">{{ tag.display_name || tag.name }}</span>
                    <span class="private-combinable">{{ tag.combinable ? '是' : '否' }}</span>
                    <span class="mutual-summary">{{ formatMutualNames(tag.mutually_exclusive_with) || '-' }}</span>
                    <span class="private-row-actions">
                      <button type="button" class="private-row-btn edit" @click="openTagEdit(tag)">
                        <img src="/icons/actions/edit-64x64.png" alt="" />
                        <span>编辑</span>
                      </button>
                      <button type="button" class="private-row-btn delete" @click="deleteMyTag(tag)">
                        <img src="/icons/actions/delete-64x64.png" alt="" />
                        <span>删除</span>
                      </button>
                    </span>
                  </div>
                  <div v-if="myTags.length === 0" class="tag-empty-msg">暂无私有标签</div>
                </div>
                <div class="private-tags-footer">
                  <span>共 {{ formatCount(myTags.length) }} 条</span>
                  <div class="private-footer-tools">
                    <div class="tag-page-nav">
                      <button type="button" class="tag-page-arrow" :disabled="privateTagPage <= 1" @click="goPrivateTagPage(privateTagPage - 1)">
                        <img src="/icons/gallery/pagination-prev-64x64.png" alt="" />
                      </button>
                      <button
                        v-for="item in privateTagPageItems"
                        :key="item.key"
                        type="button"
                        class="tag-page-number"
                        :class="{ active: item.page === privateTagPage, ellipsis: item.ellipsis }"
                        :disabled="item.ellipsis"
                        @click="!item.ellipsis && goPrivateTagPage(item.page)"
                      >{{ item.label }}</button>
                      <button type="button" class="tag-page-arrow" :disabled="privateTagPage >= privateTagTotalPages" @click="goPrivateTagPage(privateTagPage + 1)">
                        <img src="/icons/gallery/pagination-next-64x64.png" alt="" />
                      </button>
                    </div>
                    <TaotuSelect v-model="privateTagPageSize" class="tag-page-size-select" :options="privateTagPageSizeOptions" @change="onPrivateTagPageSizeChange" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="tag-dashboard-card manual-tag-card">
            <div class="manual-layout">
              <div class="manual-main">
                <div class="manual-heading">
                  <h2>人工标签</h2>
                  <span>通过人工方式为图片打上私有标签</span>
                </div>
                <div class="manual-filter-row">
                  <div class="manual-filter-field manual-source-field">
                    <span>来源</span>
                    <button type="button" class="manual-static-select">
                      <span>我的图库</span>
                      <img src="/icons/nav/chevron-down-64x64.png" alt="" />
                    </button>
                  </div>
                  <div class="manual-filter-field">
                    <span>排序</span>
                    <TaotuSelect v-model="manualSort" class="manual-filter-select" :options="manualSortOptions" @change="loadManualImages(1)" />
                  </div>
                  <div class="manual-filter-field manual-album-field">
                    <span>相册</span>
                    <TaotuSelect v-model="manualAlbumId" class="manual-filter-select" :options="myAlbumOptions" @change="loadManualImages(1)" />
                  </div>
                </div>
                <div class="manual-select-line">请选择需要打标签的图片（已选择 {{ manualSelected.length }} 张）</div>
                <div class="manual-image-grid">
                  <button v-for="img in manualImages" :key="img.id" type="button" class="manual-image-card" :class="{ selected: manualSelected.includes(img.id) }" @click="toggleManualSelect(img.id)">
                    <img :src="getThumbUrl(img)" :alt="img.filename" loading="lazy" />
                    <span v-if="manualSelected.includes(img.id)" class="manual-check-mark">✓</span>
                  </button>
                  <div v-if="manualImages.length === 0" class="manual-empty">暂无图片</div>
                </div>
                <div class="manual-pagination-row">
                  <span>共 {{ formatCount(manualTotal) }} 张</span>
                  <div class="manual-page-nav">
                    <button type="button" class="tag-page-arrow" :disabled="manualPage <= 1" @click="loadManualImages(manualPage - 1)">
                      <img src="/icons/gallery/pagination-prev-64x64.png" alt="" />
                    </button>
                    <button
                      v-for="item in manualPageItems"
                      :key="item.key"
                      type="button"
                      class="tag-page-number"
                      :class="{ active: item.page === manualPage, ellipsis: item.ellipsis }"
                      :disabled="item.ellipsis"
                      @click="!item.ellipsis && loadManualImages(item.page)"
                    >{{ item.label }}</button>
                    <button type="button" class="tag-page-arrow" :disabled="manualPage >= manualTotalPages" @click="loadManualImages(manualPage + 1)">
                      <img src="/icons/gallery/pagination-next-64x64.png" alt="" />
                    </button>
                  </div>
                  <TaotuSelect v-model="manualPageSize" class="tag-page-size-select" :options="manualPageSizeOptions" @change="onManualPageSizeChange" />
                </div>
              </div>

              <div class="manual-side">
                <div class="manual-side-card manual-select-card">
                  <div class="manual-side-title">
                    <h3>选择私有标签 <span>（可多选）</span></h3>
                    <button type="button" @click="clearManualTags">清空</button>
                  </div>
                  <div class="manual-tag-input">
                    <input
                      v-model="manualTagDraft"
                      type="text"
                      list="manual-private-tag-list"
                      placeholder="请选择或输入私有标签"
                      @keyup.enter.prevent="addManualTagFromInput"
                    />
                    <img src="/icons/nav/chevron-down-64x64.png" alt="" />
                    <datalist id="manual-private-tag-list">
                      <option v-for="tag in myTags" :key="tag.id" :value="tag.display_name || tag.name"></option>
                    </datalist>
                  </div>
                  <p>已选择 {{ manualSelectedTagChips.length }} 个标签</p>
                  <div class="manual-chip-list">
                    <button v-for="tag in manualSelectedTagChips" :key="tag.id" type="button" class="manual-tag-chip" @click="removeManualTag(tag.id)">
                      {{ tag.label }} <span>×</span>
                    </button>
                    <span v-if="manualSelectedTagChips.length === 0" class="manual-empty-chip">未选择标签</span>
                  </div>
                </div>

                <div class="manual-side-card manual-run-card">
                  <label class="manual-overwrite-row">
                    <span class="manual-check-box">
                      <input type="checkbox" v-model="manualOverwrite" />
                      <i></i>
                    </span>
                    <strong>覆盖已有私有标签</strong>
                    <em title="勾选后会先清理这些图片已有的私有标签，再写入本次选择的标签。">i</em>
                  </label>
                  <p>勾选后将覆盖图片已存在的私有标签</p>
                  <button type="button" class="manual-run-btn" :disabled="manualLoading || manualSelected.length === 0 || (!manualOverwrite && manualTagIds.length === 0 && !manualTagDraft.trim())" @click="runManualTag">
                    <span>✦</span>
                    {{ manualLoading ? '执行中...' : '执行人工标签' }}
                  </button>
                  <small>将为选中的 {{ manualSelected.length }} 张图片打上所选私有标签</small>
                  <p v-if="manualResult" class="result-msg manual-result">{{ manualResult }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeSection === 'security'" class="panel-section security-section">
          <div class="security-top-grid" v-if="user">
            <div class="security-card account-info-card">
              <h2>账号信息</h2>
              <div class="account-profile-row">
                <button type="button" class="security-avatar" :disabled="avatarUploading" @click="avatarInputRef?.click()">
                  <img v-if="userAvatarUrl" :src="userAvatarUrl" alt="" />
                  <span v-else>{{ userInitial }}</span>
                  <span class="avatar-hover-layer">
                    <strong>+</strong>
                    <em>{{ avatarUploading ? '上传中' : '上传头像' }}</em>
                  </span>
                </button>
                <input ref="avatarInputRef" type="file" accept="image/*" class="hidden-file" @change="uploadAvatar" />
                <div class="account-profile-copy">
                  <h3>{{ user.username }}</h3>
                  <p>{{ user.email || '未绑定邮箱' }}</p>
                  <span>{{ userRoleLabel }}</span>
                </div>
              </div>
              <div class="account-stat-grid">
                <div class="account-stat-box">
                  <span>用户角色</span>
                  <strong>{{ userRoleLabel }}</strong>
                </div>
                <div class="account-stat-box">
                  <span>图片数量</span>
                  <strong>{{ formatCount(dashboardStats.images) }}</strong>
                </div>
                <div class="account-stat-box">
                  <span>私有标签数量</span>
                  <strong>{{ formatCount(myTags.length) }}</strong>
                </div>
              </div>
              <p v-if="avatarMessage" class="avatar-feedback success">{{ avatarMessage }}</p>
              <p v-if="avatarError" class="avatar-feedback error">{{ avatarError }}</p>
            </div>

            <div class="security-card password-security-card">
              <h2>更改密码</h2>
              <div class="password-card-grid">
                <div class="password-form-panel">
                  <label class="password-field">
                    <span>旧密码</span>
                    <input v-model="passwordForm.oldPassword" type="password" placeholder="请输入当前密码" />
                  </label>
                  <label class="password-field">
                    <span>新密码</span>
                    <div class="password-input-wrap">
                      <input v-model="passwordForm.newPassword" :type="showNewPassword ? 'text' : 'password'" placeholder="请输入新密码（至少8位，包含字母和数字）" />
                      <button type="button" @click="showNewPassword = !showNewPassword">
                        <img :src="showNewPassword ? '/icons/actions/eye-off-64x64.png' : '/icons/actions/eye-64x64.png'" alt="" />
                      </button>
                    </div>
                  </label>
                  <label class="password-field">
                    <span>重复新密码</span>
                    <div class="password-input-wrap">
                      <input v-model="passwordForm.confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" placeholder="请再次输入新密码" @keyup.enter="changeOwnPassword" />
                      <button type="button" @click="showConfirmPassword = !showConfirmPassword">
                        <img :src="showConfirmPassword ? '/icons/actions/eye-off-64x64.png' : '/icons/actions/eye-64x64.png'" alt="" />
                      </button>
                    </div>
                  </label>
                  <button type="button" class="change-password-btn" :disabled="!canChangePassword || passwordChanging" @click="changeOwnPassword">
                    {{ passwordChanging ? '修改中...' : '更改密码' }}
                  </button>
                </div>
                <div class="password-notice-panel">
                  <div v-if="passwordMessage" class="password-notice success">
                    <span class="notice-icon">✓</span>
                    <div>
                      <strong>密码修改成功</strong>
                      <p>您的密码已成功修改，请妥善保管新密码。</p>
                      <small>3秒后自动消失</small>
                    </div>
                  </div>
                  <div v-if="passwordError" class="password-notice error">
                    <span class="notice-icon">×</span>
                    <div>
                      <strong>修改失败</strong>
                      <p>{{ passwordError }}</p>
                    </div>
                    <button type="button" @click="passwordError = ''">×</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="security-card api-token-security-card">
            <div class="api-token-heading">
              <h2>API Token <span>管理</span></h2>
              <p>使用 API Token 访问桃图智库 API，注意妥善保管，切勿泄露给他人。</p>
              <button type="button" class="token-create-button" @click="openTokenModal">
                <img src="/icons/actions/add-64x64.png" alt="" />
                <span>生成新 Token</span>
              </button>
            </div>

            <div v-if="newTokenValue" class="new-token-warning">
              <button type="button" class="new-token-close" @click="newTokenValue = ''">×</button>
              <div class="new-token-title">
                <span class="bulb-placeholder">✦</span>
                <strong>新 Token 仅显示一次</strong>
              </div>
              <p>请立即复制并妥善保存，离开此页面后将无法再次查看！</p>
              <div class="new-token-value">
                <code>{{ newTokenValue }}</code>
                <button type="button" @click="copyToken">复制</button>
              </div>
            </div>

            <div class="token-table">
              <div class="token-table-head">
                <span>Token 名称</span>
                <span>Token（部分隐藏）</span>
                <span>创建时间</span>
                <span>最后使用</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              <div class="token-table-body">
                <div v-for="token in pagedTokens" :key="token.id" class="token-table-row">
                  <span class="token-name">{{ token.label || '未命名 Token' }}</span>
                  <span class="token-masked">{{ maskToken(token.token) }}</span>
                  <span>{{ formatDateTime(token.created_at) }}</span>
                  <span>{{ token.last_used_at ? formatDateTime(token.last_used_at) : '从未使用' }}</span>
                  <span><i class="token-status">已启用</i></span>
                  <span class="token-actions">
                    <button type="button" @click="deleteToken(token.id)">删除</button>
                  </span>
                </div>
                <div v-if="myTokens.length === 0" class="token-empty">暂无 Token</div>
              </div>
              <div class="token-table-footer">
                <span>共 {{ formatCount(myTokens.length) }} 条</span>
                <div class="token-page-nav">
                  <button type="button" class="tag-page-arrow" :disabled="tokenPage <= 1" @click="goTokenPage(tokenPage - 1)">
                    <img src="/icons/gallery/pagination-prev-64x64.png" alt="" />
                  </button>
                  <button
                    v-for="item in tokenPageItems"
                    :key="item.key"
                    type="button"
                    class="tag-page-number"
                    :class="{ active: item.page === tokenPage, ellipsis: item.ellipsis }"
                    :disabled="item.ellipsis"
                    @click="!item.ellipsis && goTokenPage(item.page)"
                  >{{ item.label }}</button>
                  <button type="button" class="tag-page-arrow" :disabled="tokenPage >= tokenTotalPages" @click="goTokenPage(tokenPage + 1)">
                    <img src="/icons/gallery/pagination-next-64x64.png" alt="" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>


      </main>
    </div>

    <div v-if="showTokenModal" class="modal-overlay" @click.self="closeTokenModal">
      <div class="token-create-modal">
        <button type="button" class="token-modal-close" @click="closeTokenModal">×</button>
        <h3>新建 Token</h3>
        <div class="token-modal-field">
          <label>Token 名称</label>
          <div class="token-modal-input">
            <input v-model="tokenLabel" maxlength="50" placeholder="请输入 Token 名称（如：我的应用）" @keyup.enter="createToken" />
            <em>{{ tokenLabel.length }}/50</em>
          </div>
        </div>
        <div class="token-modal-divider"></div>
        <div class="token-modal-actions">
          <button type="button" class="token-cancel-btn" @click="closeTokenModal">取消</button>
          <button type="button" class="token-save-btn" @click="createToken">生成 Token</button>
        </div>
      </div>
    </div>

    <div v-if="showTagModal" class="modal-overlay" @click.self="closeTagModal">
      <div class="tag-edit-modal">
        <button type="button" class="tag-modal-close" @click="closeTagModal">×</button>
        <h3>{{ editingTag ? '编辑标签' : '新建标签' }}</h3>
        <div class="tag-modal-field">
          <label>标签名称 <span>*</span></label>
          <div class="tag-modal-input">
            <input v-model="tagForm.name" :disabled="!!editingTag" maxlength="50" placeholder="请输入英文或数字，建议下划线命名" />
            <em>{{ tagForm.name.length }}/50</em>
          </div>
        </div>
        <div class="tag-modal-field">
          <label>显示名 <span>*</span></label>
          <div class="tag-modal-input">
            <input v-model="tagForm.display_name" maxlength="50" placeholder="请输入显示名" />
            <em>{{ tagForm.display_name.length }}/50</em>
          </div>
        </div>
        <div class="tag-modal-switch-row">
          <span>是否可组合 <i title="开启后该标签可与其它私有标签同时应用；关闭后适合用于互斥分类。">i</i></span>
          <label class="tag-switch" :class="{ active: tagForm.combinable }">
            <input type="checkbox" v-model="tagForm.combinable" />
            <i></i>
          </label>
        </div>
        <div class="tag-modal-field">
          <label>互斥私有标签 <i title="互斥标签会成组互相排斥，选择其中一个时应避免同时选择同组其它标签。">i</i></label>
          <div class="tag-mutual-select">
            <span>{{ tagForm.mutualIds.length > 0 ? `已选择 ${tagForm.mutualIds.length} 个互斥标签` : '请选择互斥的私有标签（可多选）' }}</span>
            <img src="/icons/nav/chevron-down-64x64.png" alt="" />
          </div>
          <div class="tag-mutual-list">
            <button
              v-for="tag in mutualTagOptions"
              :key="tag.id"
              type="button"
              class="tag-mutual-chip"
              :class="{ selected: tagForm.mutualIds.includes(tag.id) }"
              @click="toggleMutualTag(tag.id)"
            >{{ tag.display_name || tag.name }}</button>
            <span v-if="mutualTagOptions.length === 0" class="empty-inline">暂无其它私有标签</span>
          </div>
        </div>
        <div class="tag-modal-actions">
          <button type="button" class="tag-cancel-btn" @click="closeTagModal">取消</button>
          <button type="button" class="tag-save-btn" @click="saveMyTag">保存</button>
        </div>
      </div>
    </div>

    <div v-if="editingImage" class="modal-overlay" @click.self="closeImageEdit">
      <div class="image-edit-modal">
        <button type="button" class="image-edit-close" @click="closeImageEdit">×</button>
        <h3>编辑图片信息</h3>
        <div class="image-edit-field">
          <label>私有标签</label>
          <button type="button" class="edit-tag-select" @click="showEditTagPicker = !showEditTagPicker">
            <span>搜索或选择标签</span>
            <img src="/icons/nav/chevron-down-64x64.png" alt="" />
          </button>
        </div>
        <div v-if="showEditTagPicker" class="edit-tag-picker">
          <TagSelector :tags="privateTagOptions" :selectedTagIds="editTagIds" @update:selectedTagIds="editTagIds = $event" />
        </div>
        <div class="selected-tags-block">
          <div class="selected-tags-title">
            <span>已选标签 ({{ editTagChips.length }})</span>
            <button type="button" @click="editTagIds = []">清空</button>
          </div>
          <div class="selected-tag-list">
            <button v-for="tag in editTagChips" :key="tag.id" type="button" class="selected-tag-chip" @click="removeEditTag(tag.id)">
              {{ tag.label }} <span>×</span>
            </button>
            <span v-if="editTagChips.length === 0" class="empty-selected-tags">未选择标签</span>
          </div>
        </div>
        <div class="image-edit-actions">
          <button type="button" class="edit-cancel-btn" @click="closeImageEdit">取消</button>
          <button type="button" class="edit-save-btn" @click="saveImageTags">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'

const api = useApi()
const config = useRuntimeConfig()
const router = useRouter()

const activeSection = ref('overview')
const user = ref(null)
const loading = ref(true)
const myImages = ref([])
const myTotal = ref(0)
const myPage = ref(1)
const imagePageSize = ref(7)
const imageSearch = ref('')
const imageSearchDraft = ref('')
const imageJumpPage = ref(1)
const imageAlbumId = ref(null)
const showImageMoreFilters = ref(false)
const imageFilterTagIds = ref([])
const imageMultiMode = ref(false)
const selectedImageIds = ref([])
const myAlbums = ref([])
const myTokens = ref([])
const showTokenModal = ref(false)
const tokenLabel = ref('')
const newTokenValue = ref('')
const tokenPage = ref(1)
const tokenPageSize = 3
const myTags = ref([])
const recentUploads = ref([])
const browserInfo = ref({ browser: 'Unknown', os: 'Unknown' })
const selectedPrivateTagIds = ref([])
const showTagModal = ref(false)
const editingTag = ref(null)
const tagForm = reactive({ name: '', display_name: '', combinable: true, mutualIds: [] })
const privateTagPage = ref(1)
const privateTagPageSize = ref(10)
const editingImage = ref(null)
const editTagIds = ref([])
const showEditTagPicker = ref(false)
const manualImages = ref([])
const manualTotal = ref(0)
const manualPage = ref(1)
const manualPageSize = ref(10)
const manualSort = ref('created_at')
const manualAlbumId = ref(null)
const manualSelected = ref([])
const manualTagIds = ref([])
const manualTagDraft = ref('')
const manualOverwrite = ref(false)
const manualLoading = ref(false)
const manualResult = ref('')
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordChanging = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const myAlbumOptions = computed(() => [
  { label: '全部相册', value: null },
  ...myAlbums.value.map(album => ({ label: album.name, value: album.id }))
])
const manualSortOptions = [
  { label: '最新', value: 'created_at' },
  { label: '最热门', value: 'view_count' }
]
const imagePageSizeOptions = [
  { label: '7 条/页', value: 7 },
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 }
]
const privateTagPageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 }
]
const manualPageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 }
]
const passwordMessage = ref('')
const passwordError = ref('')
const avatarInputRef = ref(null)
const avatarUploading = ref(false)
const avatarMessage = ref('')
const avatarError = ref('')
const dashboardStats = reactive({
  images: 0,
  storage: 0,
  privateTags: 0,
  albums: 0,
  quotaBytes: 0,
  availableBytes: 0,
  storagePercent: 0
})

const navItems = [
  { key: 'overview', label: '统计', icon: '/icons/dashboard/overview-64x64.png' },
  { key: 'images', label: '图片管理', icon: '/icons/dashboard/image-management-64x64.png' },
  { key: 'tags', label: '标签设置', icon: '/icons/dashboard/tag-settings-64x64.png' },
  { key: 'security', label: '账户与安全', icon: '/icons/dashboard/account-security-64x64.png' }
]

const userInitial = computed(() => (user.value?.username || 'U').slice(0, 1).toUpperCase())
const userAvatarUrl = computed(() => normalizeAssetUrl(user.value?.avatar))
const userRoleLabel = computed(() => user.value?.role === 'admin' ? '管理员' : '普通用户')
const storagePercent = computed(() => Math.max(0, Math.min(Number(dashboardStats.storagePercent || 0), 100)))
const storagePercentLabel = computed(() => dashboardStats.quotaBytes > 0 ? `${storagePercent.value.toFixed(storagePercent.value >= 10 ? 1 : 0)}%` : '不限')
const storageRingStyle = computed(() => ({
  background: `conic-gradient(#f66fa3 0 ${storagePercent.value * 0.62}%, #a984ff ${storagePercent.value * 0.62}% ${storagePercent.value}%, #edf1f8 ${storagePercent.value}% 100%)`
}))
const storageProgressStyle = computed(() => ({ width: `${dashboardStats.quotaBytes > 0 ? storagePercent.value : 100}%` }))
const quotaSummaryText = computed(() => dashboardStats.quotaBytes > 0 ? `占用 ${storagePercent.value.toFixed(1)}%` : '不限容量')
const privateTagOptions = computed(() => {
  const mapped = myTags.value.map(tag => ({ id: 'u' + tag.id, name: tag.name, display_name: tag.display_name || tag.name, combinable: !!tag.combinable, mutually_exclusive_with: tag.mutually_exclusive_with, isUserTag: true }))
  return { combinable: mapped.filter(tag => tag.combinable !== false), nonCombinable: mapped.filter(tag => tag.combinable === false) }
})
const canChangePassword = computed(() => {
  return !!passwordForm.oldPassword && !!passwordForm.newPassword && !!passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword
})
const allMyImagesSelected = computed(() => myImages.value.length > 0 && myImages.value.every(img => selectedImageIds.value.includes(img.id)))
const imageTotalPages = computed(() => Math.max(1, Math.ceil((myTotal.value || 0) / Number(imagePageSize.value || 7))))
const imagePageItems = computed(() => buildPageItems(myPage.value, imageTotalPages.value))
const privateTagTotalPages = computed(() => Math.max(1, Math.ceil((myTags.value.length || 0) / Number(privateTagPageSize.value || 10))))
const pagedPrivateTags = computed(() => {
  const start = (privateTagPage.value - 1) * Number(privateTagPageSize.value || 10)
  return myTags.value.slice(start, start + Number(privateTagPageSize.value || 10))
})
const privateTagPageItems = computed(() => buildPageItems(privateTagPage.value, privateTagTotalPages.value))
const manualTotalPages = computed(() => Math.max(1, Math.ceil((manualTotal.value || 0) / Number(manualPageSize.value || 10))))
const manualPageItems = computed(() => buildPageItems(manualPage.value, manualTotalPages.value))
const tokenTotalPages = computed(() => Math.max(1, Math.ceil((myTokens.value.length || 0) / tokenPageSize)))
const pagedTokens = computed(() => {
  const start = (tokenPage.value - 1) * tokenPageSize
  return myTokens.value.slice(start, start + tokenPageSize)
})
const tokenPageItems = computed(() => buildPageItems(tokenPage.value, tokenTotalPages.value))
const editTagChips = computed(() => editTagIds.value.map(id => {
  const normalized = String(id).replace(/^u/i, '')
  const tag = myTags.value.find(item => String(item.id) === normalized)
  return tag ? { id, label: tag.display_name || tag.name } : { id, label: String(id) }
}))
const manualSelectedTagChips = computed(() => manualTagIds.value.map(id => {
  const normalized = String(id).replace(/^u/i, '')
  const tag = myTags.value.find(item => String(item.id) === normalized)
  return tag ? { id, label: tag.display_name || tag.name } : { id, label: String(id) }
}))

const parseUserMutualIds = (value) => {
  if (!value) return []
  return String(value)
    .split(/[,，.。\s]+/)
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => /^u\d+$/i.test(id) ? parseInt(id.slice(1)) : (/^\d+$/.test(id) ? Number(id) : null))
    .filter(id => Number.isInteger(id))
}
const mutualTagOptions = computed(() => myTags.value.filter(tag => tag.id !== editingTag.value?.id))
const allPrivateTagsSelected = computed(() => pagedPrivateTags.value.length > 0 && pagedPrivateTags.value.every(tag => selectedPrivateTagIds.value.includes(tag.id)))
const formatMutualNames = (value) => {
  const ids = parseUserMutualIds(value)
  return ids.map(id => myTags.value.find(tag => tag.id === id)).filter(Boolean).map(tag => tag.display_name || tag.name).join('，')
}
const toggleMutualTag = (id) => {
  const idx = tagForm.mutualIds.indexOf(id)
  if (idx >= 0) tagForm.mutualIds.splice(idx, 1)
  else tagForm.mutualIds.push(id)
  if (tagForm.mutualIds.length > 0) tagForm.combinable = false
}

const normalizeAssetUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}

onMounted(async () => {
  const token = localStorage.getItem('jwt_token')
  if (!token) { router.push('/login'); return }
  browserInfo.value = detectBrowserInfo()
  try {
    user.value = await api.get('/api/admin/auth/me')
    await Promise.all([loadDashboardOverview(), loadMyTags(), loadMyAlbums(), loadTokens()])
    await Promise.all([loadMyImages(), loadManualImages()])
  } catch {} finally { loading.value = false }
})

const loadDashboardOverview = async () => {
  try {
    const data = await api.get('/api/internal/dashboard/overview')
    if (data.user) user.value = data.user
    Object.assign(dashboardStats, {
      images: Number(data.stats?.images || 0),
      storage: Number(data.stats?.storage || 0),
      privateTags: Number(data.stats?.privateTags || 0),
      albums: Number(data.stats?.albums || 0),
      quotaBytes: Number(data.stats?.quotaBytes || 0),
      availableBytes: Number(data.stats?.availableBytes || 0),
      storagePercent: Number(data.stats?.storagePercent || 0)
    })
    recentUploads.value = data.recentUploads || []
  } catch {}
}

const loadMyImages = async (p = 1) => {
  myPage.value = p
  selectedImageIds.value = []
  try {
    const data = await api.get('/api/internal/images', {
      page: p,
      limit: imagePageSize.value,
      mine: 'true',
      album: imageAlbumId.value || undefined,
      search: imageSearch.value || undefined,
      tags: imageFilterTagIds.value.length > 0 ? imageFilterTagIds.value.join(',') : undefined
    })
    myImages.value = data.images || []
    myTotal.value = data.total || 0
    imageJumpPage.value = p
  } catch {}
}

const loadManualImages = async (p = 1) => {
  manualPage.value = p
  manualSelected.value = []
  try {
    const data = await api.get('/api/internal/images', { page: p, limit: manualPageSize.value, mine: 'true', sort: manualSort.value, order: 'desc', album: manualAlbumId.value || undefined })
    manualImages.value = data.images || []
    manualTotal.value = data.total || 0
  } catch {}
}

const loadMyAlbums = async () => {
  try {
    const data = await api.get('/api/internal/albums', { limit: 200, mine: 'true' })
    myAlbums.value = data.albums || []
    dashboardStats.albums = Number(data.total || myAlbums.value.length || dashboardStats.albums)
  } catch {}
}
const loadTokens = async () => {
  try {
    const data = await api.get('/api/admin/api/tokens')
    myTokens.value = data.tokens || []
    if (tokenPage.value > tokenTotalPages.value) tokenPage.value = tokenTotalPages.value
  } catch {}
}
const loadMyTags = async () => {
  try {
    const data = await api.get('/api/user-tags')
    myTags.value = data.tags || []
    dashboardStats.privateTags = myTags.value.length
    selectedPrivateTagIds.value = selectedPrivateTagIds.value.filter(id => myTags.value.some(tag => tag.id === id))
    if (privateTagPage.value > privateTagTotalPages.value) privateTagPage.value = privateTagTotalPages.value
  } catch {}
}


const togglePrivateTagSelect = (id) => {
  const idx = selectedPrivateTagIds.value.indexOf(id)
  if (idx >= 0) selectedPrivateTagIds.value.splice(idx, 1)
  else selectedPrivateTagIds.value.push(id)
}

const toggleSelectAllPrivateTags = () => {
  const currentIds = pagedPrivateTags.value.map(tag => tag.id)
  if (allPrivateTagsSelected.value) selectedPrivateTagIds.value = selectedPrivateTagIds.value.filter(id => !currentIds.includes(id))
  else selectedPrivateTagIds.value = [...new Set([...selectedPrivateTagIds.value, ...currentIds])]
}

const goPrivateTagPage = (page) => {
  privateTagPage.value = Math.max(1, Math.min(Number(page) || 1, privateTagTotalPages.value))
}

const onPrivateTagPageSizeChange = () => {
  goPrivateTagPage(1)
}

const deleteSelectedPrivateTags = async () => {
  if (selectedPrivateTagIds.value.length === 0) return
  if (!confirm('确定删除选中的 ' + selectedPrivateTagIds.value.length + ' 个私有标签？关联的图片标签也会被清除。')) return
  try {
    for (const id of selectedPrivateTagIds.value) await api.del('/api/user-tags/' + id)
    selectedPrivateTagIds.value = []
    await loadMyTags(); await loadMyImages(myPage.value); await loadManualImages(manualPage.value)
  } catch (err) { alert('批量删除失败: ' + (err.data?.error || err.message)) }
}

const setSelectedPrivateTagsPublic = async () => {
  if (user.value?.role !== 'admin' || selectedPrivateTagIds.value.length === 0) return
  try {
    for (const id of selectedPrivateTagIds.value) {
      await api.post('/api/admin/tag-convert/toggle', { tagId: id, isUserTag: true, is_public: true })
    }
    selectedPrivateTagIds.value = []
    await loadMyTags()
  } catch (err) { alert('批量设为公共失败: ' + (err.data?.error || err.message)) }
}

const openTagCreate = () => { editingTag.value = null; tagForm.name = ''; tagForm.display_name = ''; tagForm.combinable = true; tagForm.mutualIds = []; showTagModal.value = true }
const openTagEdit = (tag) => { editingTag.value = tag; tagForm.name = tag.name; tagForm.display_name = tag.display_name || tag.name; tagForm.combinable = tag.combinable !== false; tagForm.mutualIds = parseUserMutualIds(tag.mutually_exclusive_with).filter(id => id !== tag.id); showTagModal.value = true }
const closeTagModal = () => { showTagModal.value = false; editingTag.value = null; tagForm.mutualIds = [] }

const saveMyTag = async () => {
  if (!tagForm.name.trim()) return alert('请输入标签名')
  try {
    if (editingTag.value) await api.put('/api/user-tags/' + editingTag.value.id, { display_name: tagForm.display_name.trim() || tagForm.name.trim(), combinable: tagForm.combinable, mutually_exclusive_with: tagForm.mutualIds.map(id => 'u' + id).join(',') })
    else await api.post('/api/user-tags', { name: tagForm.name.trim(), display_name: tagForm.display_name.trim() || tagForm.name.trim(), combinable: tagForm.combinable, mutually_exclusive_with: tagForm.mutualIds.map(id => 'u' + id).join(',') })
    closeTagModal(); await loadMyTags()
  } catch (err) { alert('保存失败: ' + (err.data?.error || err.message)) }
}

const deleteMyTag = async (tag) => {
  if (!confirm('确定删除标签 "' + (tag.display_name || tag.name) + '"？')) return
  try { await api.del('/api/user-tags/' + tag.id); await loadMyTags(); await loadMyImages(myPage.value); await loadManualImages(manualPage.value) } catch { alert('删除失败') }
}

const openImageEdit = (img) => {
  editingImage.value = img
  showEditTagPicker.value = false
  editTagIds.value = (img.tags || [])
    .filter(tag => tag.source === 'user' || tag.user_tag_id)
    .map(tag => typeof tag.id === 'string' && tag.id.startsWith('u') ? tag.id : 'u' + (tag.user_tag_id || tag.id))
}
const closeImageEdit = () => { editingImage.value = null; editTagIds.value = []; showEditTagPicker.value = false }
const saveImageTags = async () => {
  if (!editingImage.value) return
  try { await api.post('/api/user-tags/apply', { imageIds: [editingImage.value.id], tagIds: editTagIds.value, mode: 'replace' }); closeImageEdit(); await loadMyImages(myPage.value); await loadManualImages(manualPage.value) }
  catch (err) { alert('保存失败: ' + (err.data?.error || err.message)) }
}
const removeEditTag = (id) => {
  editTagIds.value = editTagIds.value.filter(item => item !== id)
}

const toggleImageMultiMode = () => {
  imageMultiMode.value = !imageMultiMode.value
  if (!imageMultiMode.value) selectedImageIds.value = []
}
const toggleImageSelect = (id) => { const idx = selectedImageIds.value.indexOf(id); if (idx >= 0) selectedImageIds.value.splice(idx, 1); else selectedImageIds.value.push(id) }
const selectAllMyImages = () => { selectedImageIds.value = myImages.value.map(img => img.id) }
const deselectMyImages = () => { selectedImageIds.value = [] }
const toggleSelectAllCurrentImages = () => {
  if (allMyImagesSelected.value) deselectMyImages()
  else selectAllMyImages()
}
const applyImageSearch = () => {
  imageSearch.value = imageSearchDraft.value.trim()
  loadMyImages(1)
}
const onImageFilterTagsChange = (ids) => {
  imageFilterTagIds.value = ids
  loadMyImages(1)
}
const onImagePageSizeChange = () => {
  loadMyImages(1)
}
const onManualPageSizeChange = () => {
  loadManualImages(1)
}
const jumpToImagePage = () => {
  const target = Math.max(1, Math.min(Number(imageJumpPage.value) || 1, imageTotalPages.value))
  imageJumpPage.value = target
  loadMyImages(target)
}
const batchSetMyImagesPublic = async (isPublic) => {
  if (selectedImageIds.value.length === 0) return
  let success = 0
  for (const id of selectedImageIds.value) {
    try { await api.put('/api/admin/images/' + id, { is_public: isPublic }); success++ } catch {}
  }
  alert('已' + (isPublic ? '设为公共' : '取消公共') + ': ' + success + ' 张')
  await loadMyImages(myPage.value)
}
const batchDeleteMyImages = async () => {
  if (selectedImageIds.value.length === 0) return
  if (!confirm('确定删除选中的 ' + selectedImageIds.value.length + ' 张图片？')) return
  let success = 0, fail = 0
  for (const id of selectedImageIds.value) {
    try { await api.del('/api/admin/images/' + id); success++ } catch { fail++ }
  }
  alert('删除完成: ' + success + ' 成功, ' + fail + ' 失败')
  await loadMyImages(myPage.value)
  await loadManualImages(manualPage.value)
}

const toggleManualSelect = (id) => { const idx = manualSelected.value.indexOf(id); if (idx >= 0) manualSelected.value.splice(idx, 1); else manualSelected.value.push(id) }
const addManualTagFromInput = async () => {
  const label = manualTagDraft.value.trim()
  if (!label) return
  const matched = myTags.value.find(tag => [tag.name, tag.display_name].filter(Boolean).some(value => String(value).toLowerCase() === label.toLowerCase()))
  if (matched) {
    const id = 'u' + matched.id
    if (!manualTagIds.value.includes(id)) manualTagIds.value.push(id)
    manualTagDraft.value = ''
    return id
  }
  try {
    const data = await api.post('/api/user-tags', { name: label, display_name: label, combinable: true, mutually_exclusive_with: '' })
    await loadMyTags()
    const id = 'u' + data.id
    if (!manualTagIds.value.includes(id)) manualTagIds.value.push(id)
    manualTagDraft.value = ''
    return id
  } catch (err) {
    alert('创建标签失败: ' + (err.data?.error || err.message))
    return null
  }
}
const removeManualTag = (id) => {
  manualTagIds.value = manualTagIds.value.filter(item => item !== id)
}
const clearManualTags = () => {
  manualTagIds.value = []
  manualTagDraft.value = ''
}
const runManualTag = async () => {
  if (manualSelected.value.length === 0) return
  if (manualTagDraft.value.trim()) {
    const createdId = await addManualTagFromInput()
    if (!createdId) return
  }
  if (!manualOverwrite.value && manualTagIds.value.length === 0) return
  manualLoading.value = true; manualResult.value = ''
  try {
    await api.post('/api/user-tags/apply', { imageIds: manualSelected.value, tagIds: manualTagIds.value, mode: manualOverwrite.value ? 'replace' : 'add' })
    manualResult.value = '标签完成'; manualSelected.value = []; manualTagIds.value = []
    await loadManualImages(manualPage.value); await loadMyImages(myPage.value)
  } catch (err) { manualResult.value = '失败: ' + (err.data?.error || err.message) }
  finally { manualLoading.value = false }
}

const togglePublic = async (img) => { try { await api.put('/api/admin/images/' + img.id, { is_public: !img.is_public }); img.is_public = !img.is_public } catch { alert('操作失败') } }
const deleteMyImage = async (img) => {
  if (!confirm('确定删除图片 "' + img.filename + '"？')) return
  try { await api.del('/api/admin/images/' + img.id); await loadMyImages(myPage.value); await loadManualImages(manualPage.value) } catch (err) { alert('删除失败: ' + (err.data?.error || err.message)) }
}

const changeOwnPassword = async () => {
  passwordError.value = ''
  passwordMessage.value = ''
  if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    passwordError.value = '请完整填写旧密码和新密码'
    return
  }
  if (passwordForm.newPassword.length < 6) {
    passwordError.value = '新密码至少6位'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = '两次新密码不一致'
    return
  }

  passwordChanging.value = true
  try {
    await api.post('/api/admin/auth/change-password', { oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword })
    passwordMessage.value = '密码修改成功'
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    window.setTimeout(() => { passwordMessage.value = '' }, 3000)
  } catch (err) {
    passwordError.value = err.data?.error || err.message || '密码修改失败'
  } finally {
    passwordChanging.value = false
  }
}

const uploadAvatar = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  avatarUploading.value = true
  avatarMessage.value = ''
  avatarError.value = ''
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await api.request('/api/admin/auth/upload-avatar', { method: 'POST', body: fd })
    user.value = { ...user.value, avatar: res.url }
    avatarMessage.value = '头像已上传'
  } catch (err) {
    avatarError.value = err.data?.error || err.message || '头像上传失败'
  } finally {
    avatarUploading.value = false
    event.target.value = ''
  }
}

const goTokenPage = (page) => {
  tokenPage.value = Math.max(1, Math.min(Number(page) || 1, tokenTotalPages.value))
}
const maskToken = (value) => {
  const token = String(value || '')
  if (!token) return '-'
  if (token.length <= 10) return token
  return `${token.slice(0, 7)}••••${token.slice(-4)}`
}
const openTokenModal = () => {
  tokenLabel.value = ''
  showTokenModal.value = true
}
const closeTokenModal = () => {
  showTokenModal.value = false
  tokenLabel.value = ''
}
const createToken = async () => {
  try {
    const data = await api.post('/api/admin/api/tokens', { label: tokenLabel.value.trim(), user_id: user.value?.id })
    newTokenValue.value = data.token
    closeTokenModal()
    await loadTokens()
    tokenPage.value = 1
  } catch (err) { alert('创建失败: ' + (err.data?.error || err.message)) }
}
const deleteToken = async (id) => { if (!confirm('确定删除此 Token？')) return; try { await api.del('/api/admin/api/tokens/' + id); await loadTokens() } catch { alert('删除失败') } }
const copyToken = async () => { try { await navigator.clipboard.writeText(newTokenValue.value); alert('已复制') } catch {} }
const getThumbUrl = (img) => { const url = img.thumb_url || img.url; return url ? (config.public.apiBase || '') + url : '' }
const formatCount = (value) => Number(value || 0).toLocaleString('en-US')
const formatViewCount = (value) => {
  const count = Number(value || 0)
  if (count >= 10000) return `${(count / 10000).toFixed(1)} 万`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return count.toLocaleString('en-US')
}
const formatSize = (bytes) => {
  const size = Number(bytes || 0)
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`
}
const splitSize = (bytes) => {
  const parts = formatSize(bytes).split(' ')
  return { value: parts[0] || '0', unit: parts[1] || 'B' }
}
const pad2 = (value) => String(value).padStart(2, '0')
const formatDateOnly = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}
const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}
const formatDate = (value) => formatDateOnly(value)
const formatDateMinute = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}
const formatRelativeTime = (value) => {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  const diff = Math.max(0, Date.now() - date.getTime())
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < day * 2) return '昨天'
  if (diff < day * 7) return `${Math.floor(diff / day)}天前`
  return formatDateOnly(value)
}
const detectBrowserInfo = () => {
  if (!import.meta.client) return { browser: 'Unknown', os: 'Unknown' }
  const ua = window.navigator.userAgent || ''
  const browser = ua.includes('Edg/') ? 'Edge'
    : ua.includes('Chrome/') ? 'Chrome'
    : ua.includes('Firefox/') ? 'Firefox'
    : ua.includes('Safari/') ? 'Safari'
    : 'Browser'
  const os = ua.includes('Windows') ? 'Windows'
    : ua.includes('Mac OS') ? 'macOS'
    : ua.includes('Linux') ? 'Linux'
    : ua.includes('Android') ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : 'System'
  return { browser, os }
}
const normalizedImageTags = (img) => (img.tags || []).map((tag, index) => ({
  key: `${tag.source || 'tag'}-${tag.id || tag.user_tag_id || index}`,
  label: tag.display_name || tag.name || '标签'
}))
const buildPageItems = (current, total) => {
  const items = []
  const pushPage = (page) => {
    if (page < 1 || page > total || items.some(item => item.page === page)) return
    items.push({ key: `p-${page}`, page, label: String(page) })
  }
  const pushEllipsis = (key) => items.push({ key, label: '...', ellipsis: true })

  if (total <= 7) {
    for (let page = 1; page <= total; page += 1) pushPage(page)
    return items
  }

  pushPage(1)
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pushEllipsis('e-left')
  for (let page = start; page <= end; page += 1) pushPage(page)
  if (end < total - 1) pushEllipsis('e-right')
  pushPage(total)
  return items
}
</script>

<style scoped>
.dashboard-page {
  max-width: 1480px;
}
.dashboard-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
  padding: 0;
}
.dashboard-sidebar {
  position: sticky;
  top: 18px;
  align-self: stretch;
  min-height: 100%;
  padding: 22px 10px 18px;
  border: 1px solid rgba(255,255,255,0.78);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.76), rgba(255,255,255,0.56));
  box-shadow: 0 18px 48px rgba(87, 97, 130, 0.09);
  backdrop-filter: blur(22px);
}
.profile-block {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 13px;
  align-items: center;
  min-height: 74px;
  padding: 0 12px 22px;
}
.avatar-mark {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #ff91b9, #a88cff);
  color: white;
  font-size: 22px;
  font-weight: 900;
  box-shadow: 0 12px 28px rgba(248,95,154,0.22);
}
.avatar-mark img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.profile-copy {
  min-width: 0;
}
.profile-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.profile-block h1 {
  color: #2f3549;
  font-size: 17px;
  line-height: 1.15;
  font-weight: 900;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-badge {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 119, 166, 0.14);
  color: #f06599;
  font-size: 11px;
  line-height: 1;
  font-weight: 900;
}
.profile-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  color: #8c94a8;
  font-size: 8px;
  line-height: 1.2;
  white-space: nowrap;
}
.meta-divider {
  width: 1px;
  height: 10px;
  background: rgba(130, 139, 160, 0.32);
}
.dashboard-nav {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.nav-item {
  width: 100%;
  height: 39px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 17px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  color: #596277;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  font-weight: 900;
  transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
}
.nav-item img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  opacity: 0.68;
}
.nav-item:hover {
  background: rgba(255, 239, 246, 0.72);
}
.nav-item.active {
  background: rgba(255, 232, 242, 0.88);
  border-color: rgba(255, 178, 207, 0.72);
  color: #f05f98;
}
.nav-item.active img {
  opacity: 1;
}
.dashboard-content {
  min-width: 0;
  height: 100%;
}
.panel-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}
.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}
.dashboard-overview-title {
  min-height: 24px;
  margin-bottom: 14px;
}
.header-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.content-header h2 {
  color: #2f3549;
  font-size: 18px;
  font-weight: 900;
  margin: 0;
}
.overview-top-panel,
.recent-panel,
.side-card {
  border: 1px solid rgba(255,255,255,0.76);
  border-radius: 10px;
  background: rgba(255,255,255,0.62);
  box-shadow: 0 18px 48px rgba(87, 97, 130, 0.08);
  backdrop-filter: blur(22px);
}
.overview-top-panel {
  padding: 17px;
}
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.stat-card {
  min-height: 108px;
  display: grid;
  grid-template-columns: 66px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 18px;
  border: 1px solid rgba(229, 220, 237, 0.76);
  border-radius: 9px;
  background: rgba(255,255,255,0.6);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 12px 30px rgba(112, 96, 139, 0.06);
}
.stat-icon {
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(230, 220, 235, 0.82);
}
.stat-icon img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}
.stat-icon-pink { background: rgba(255, 233, 242, 0.72); }
.stat-icon-purple { background: rgba(243, 239, 255, 0.78); }
.stat-icon-violet { background: rgba(246, 239, 255, 0.82); }
.stat-icon-orange { background: rgba(255, 241, 232, 0.76); }
.stat-copy {
  min-width: 0;
}
.stat-label {
  display: block;
  color: #7b8498;
  font-size: 12px;
  font-weight: 900;
  margin-bottom: 4px;
}
.stat-value {
  display: block;
  color: #323a50;
  font-size: 30px;
  line-height: 1.08;
  letter-spacing: 0;
  font-weight: 900;
}
.stat-value em {
  margin-left: 4px;
  color: #445064;
  font-size: 13px;
  font-style: normal;
}
.stat-copy small {
  display: block;
  margin-top: 4px;
  color: #8b94a8;
  font-size: 11px;
  font-weight: 800;
}
.quick-actions-panel {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid rgba(239, 225, 235, 0.7);
  border-radius: 9px;
  background: rgba(255,255,255,0.42);
}
.quick-actions-panel h3,
.panel-title-row h3,
.side-card h3 {
  margin: 0;
  color: #33394d;
  font-size: 15px;
  line-height: 1;
  font-weight: 900;
}
.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 13px;
}
.action-card {
  min-height: 62px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  text-decoration: none;
  color: #40485d;
  border: 1px solid rgba(255, 181, 210, 0.62);
  border-radius: 7px;
  background: rgba(255, 240, 246, 0.55);
}
.action-api {
  border-color: rgba(179, 154, 255, 0.46);
  background: rgba(246, 241, 255, 0.62);
}
.action-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.action-icon img {
  width: 40px;
  height: 40px;
  object-fit: contain;
}
.action-text {
  min-width: 0;
}
.action-text strong {
  display: block;
  color: #3a4155;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 900;
}
.action-text small {
  display: block;
  margin-top: 2px;
  color: #8b94a8;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-arrow {
  color: #f2669d;
  font-size: 26px;
  line-height: 1;
}
.overview-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 384px;
  gap: 16px;
}
.recent-panel {
  min-height: 438px;
  padding: 16px;
}
.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 15px;
}
.view-all-btn {
  min-width: 70px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(225, 220, 232, 0.72);
  border-radius: 999px;
  background: rgba(255,255,255,0.68);
  color: #7c8498;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.recent-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 9px;
}
.recent-card {
  position: relative;
  display: block;
  aspect-ratio: 1.58 / 1;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(242, 245, 251, 0.9);
  box-shadow: 0 8px 18px rgba(60, 70, 100, 0.08);
}
.recent-card img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.recent-card::after {
  content: '';
  position: absolute;
  inset: 45% 0 0;
  background: linear-gradient(180deg, transparent, rgba(16, 24, 42, 0.45));
}
.recent-card span {
  position: absolute;
  left: 7px;
  bottom: 6px;
  z-index: 1;
  max-width: calc(100% - 14px);
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(40, 48, 68, 0.46);
  color: #fff;
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.recent-empty {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #8b94a8;
  font-size: 13px;
  font-weight: 900;
}
.recent-empty img {
  width: 112px;
  height: 112px;
  object-fit: contain;
  opacity: 0.78;
}
.overview-side-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.side-card {
  padding: 18px;
}
.storage-content {
  display: grid;
  grid-template-columns: 142px minmax(0, 1fr);
  gap: 20px;
  align-items: center;
  margin-top: 18px;
}
.storage-ring {
  width: 136px;
  height: 136px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.78);
}
.storage-ring-inner {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.9);
  box-shadow: 0 8px 22px rgba(94, 87, 122, 0.08);
}
.storage-ring-inner strong {
  color: #30384f;
  font-size: 26px;
  line-height: 1;
  font-weight: 900;
}
.storage-ring-inner span {
  margin-top: 7px;
  color: #7b8498;
  font-size: 12px;
  font-weight: 900;
}
.storage-legend {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.storage-legend div {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 8px;
  color: #737d93;
  font-size: 12px;
  font-weight: 900;
}
.storage-legend strong {
  color: #7b8498;
  font-size: 12px;
}
.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.legend-dot.used { background: #f66fa3; }
.legend-dot.free { background: #9fc7ff; }
.legend-dot.total { background: #89d7e8; }
.legend-dot.image { background: #ffa779; }
.storage-progress-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  color: #7b8498;
  font-size: 12px;
  font-weight: 900;
}
.storage-progress {
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(226, 231, 240, 0.9);
}
.storage-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f66fa3, #a984ff);
}
.account-summary-card {
  min-height: 188px;
}
.summary-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  min-height: 32px;
  border-bottom: 1px solid rgba(218, 224, 236, 0.72);
  color: #8a92a5;
  font-size: 12px;
  font-weight: 900;
}
.summary-row:first-of-type {
  margin-top: 15px;
}
.summary-row strong {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: #6b748a;
  font-weight: 900;
  text-align: right;
  min-width: 0;
}
.summary-user {
  color: #51596f;
}
.summary-avatar {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff91b9, #a88cff);
  color: white;
  font-size: 10px;
}
.summary-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pink-text {
  color: #f06599 !important;
}
.image-management-section {
  gap: 13px;
}
.image-manage-header {
  padding: 2px 10px 0;
}
.image-manage-header h2 {
  margin: 0;
  color: #2f3549;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 900;
}
.image-manage-header p {
  margin-top: 7px;
  color: #8a92a5;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 800;
}
.image-filter-card,
.image-table-card,
.image-pagination-card,
.tag-filter-panel {
  border: 1px solid rgba(226, 231, 242, 0.74);
  border-radius: 9px;
  background: rgba(255,255,255,0.64);
  box-shadow: 0 16px 42px rgba(86, 96, 128, 0.07);
  backdrop-filter: blur(22px);
}
.image-filter-card {
  min-height: 50px;
  display: grid;
  grid-template-columns: 224px 206px minmax(220px, 1fr) 188px 92px;
  align-items: center;
  gap: 11px;
  padding: 10px 13px;
}
.filter-field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.filter-label {
  color: #7c859b;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}
.filter-static-select,
.filter-dropdown-btn {
  width: 100%;
  height: 31px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.66);
  color: #586176;
  font-size: 12px;
  font-weight: 900;
}
.filter-static-select {
  justify-content: space-between;
  padding: 0 8px 0 12px;
  cursor: default;
}
.filter-static-select img,
.dropdown-caret {
  width: 13px;
  height: 13px;
  opacity: 0.62;
}
.image-filter-select {
  width: 100%;
}
.image-filter-select :deep(.taotu-select-trigger),
.page-size-select :deep(.taotu-select-trigger) {
  min-height: 31px;
  height: 31px;
  border-radius: 7px;
  background: rgba(255,255,255,0.66);
  box-shadow: none;
  font-size: 12px;
}
.image-filter-select :deep(.taotu-select-value),
.page-size-select :deep(.taotu-select-value) {
  font-size: 12px;
  font-weight: 900;
  color: #586176;
}
.filter-search {
  height: 31px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.62);
}
.filter-search img {
  width: 15px;
  height: 15px;
  opacity: 0.55;
}
.filter-search input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #3e465a;
  font-size: 12px;
  font-weight: 900;
}
.filter-search input::placeholder {
  color: #a2aabd;
}
.filter-dropdown-btn {
  justify-content: flex-start;
  padding: 0 10px;
  cursor: pointer;
}
.filter-dropdown-btn > img:first-child {
  width: 15px;
  height: 15px;
  opacity: 0.68;
}
.filter-dropdown-btn .dropdown-caret {
  margin-left: auto;
}
.filter-dropdown-btn.active {
  border-color: rgba(255, 142, 184, 0.62);
  background: rgba(255, 239, 246, 0.76);
  color: #f05f98;
}
.image-search-btn {
  height: 31px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, #f76da1, #f35f98);
  color: white;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(242, 96, 151, 0.2);
}
.image-search-btn img {
  width: 14px;
  height: 14px;
  filter: brightness(0) invert(1);
}
.tag-filter-panel {
  padding: 14px;
}
.image-table-card {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.image-batch-row {
  height: 45px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(226, 231, 242, 0.76);
}
.image-batch-row > span {
  color: #485066;
  font-size: 12px;
  font-weight: 900;
}
.batch-action-btn {
  height: 27px;
  min-width: 88px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.batch-action-btn img {
  width: 14px;
  height: 14px;
}
.batch-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.public-btn {
  border: 1px solid rgba(105, 211, 194, 0.42);
  background: rgba(232, 251, 247, 0.7);
  color: #45b7a8;
}
.private-btn {
  border: 1px solid rgba(255, 166, 196, 0.48);
  background: rgba(255, 241, 247, 0.78);
  color: #f06c9e;
}
.danger-btn {
  border: 1px solid rgba(255, 172, 188, 0.5);
  background: rgba(255, 241, 244, 0.78);
  color: #f26180;
}
.image-table-head,
.image-table-row {
  display: grid;
  grid-template-columns: 42px 148px minmax(170px, 1.05fr) minmax(180px, 1.18fr) minmax(220px, 1.2fr) 130px 148px;
  align-items: center;
  column-gap: 8px;
}
.image-table-head {
  min-height: 39px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(226, 231, 242, 0.76);
  background: rgba(247, 249, 253, 0.72);
  color: #788197;
  font-size: 12px;
  font-weight: 900;
}
.image-table-head span:nth-child(5) {
  text-align: center;
}
.image-table-scroll {
  max-height: 428px;
  overflow-y: scroll;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 141, 184, 0.52) rgba(240, 244, 251, 0.82);
}
.image-table-scroll::-webkit-scrollbar {
  width: 8px;
}
.image-table-scroll::-webkit-scrollbar-track {
  background: rgba(240, 244, 251, 0.82);
}
.image-table-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 141, 184, 0.58);
}
.image-table-scroll.empty {
  min-height: 220px;
}
.image-table-row {
  min-height: 61px;
  padding: 6px 14px;
  border-bottom: 1px solid rgba(226, 231, 242, 0.74);
  color: #51596d;
}
.image-table-row.selected {
  background: rgba(255, 237, 245, 0.58);
}
.soft-checkbox {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.soft-checkbox input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.soft-checkbox span {
  width: 14px;
  height: 14px;
  display: block;
  border: 1px solid rgba(166, 177, 197, 0.8);
  border-radius: 4px;
  background: rgba(255,255,255,0.75);
}
.soft-checkbox input:checked + span {
  border-color: #f56b9f;
  background: #f56b9f;
  box-shadow: inset 0 0 0 3px #f56b9f;
}
.soft-checkbox input:checked + span::after {
  content: '✓';
  display: block;
  color: white;
  font-size: 10px;
  line-height: 13px;
  text-align: center;
  font-weight: 900;
}
.soft-checkbox input:disabled + span {
  opacity: 0.45;
}
.table-thumb {
  width: 102px;
  height: 50px;
  overflow: hidden;
  border-radius: 5px;
  background: rgba(239, 243, 250, 0.9);
}
.table-thumb img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.table-file {
  min-width: 0;
}
.table-file strong {
  display: block;
  color: #3c4458;
  font-size: 12px;
  line-height: 1.3;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.table-file small {
  display: block;
  margin-top: 5px;
  color: #a0a7b8;
  font-size: 11px;
  font-weight: 900;
}
.table-meta {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 8px;
  color: #99a1b3;
  font-size: 11px;
  font-weight: 900;
}
.table-meta i {
  width: 1px;
  height: 10px;
  background: rgba(166, 174, 192, 0.45);
}
.meta-date {
  flex-basis: 100%;
}
.table-tags {
  width: 100%;
  min-width: 0;
  justify-self: stretch;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.table-tags.single {
  justify-content: center;
}
.table-tags.multiple {
  justify-content: flex-start;
}
.table-tag {
  max-width: 72px;
  padding: 2px 8px;
  border: 1px solid rgba(226, 231, 242, 0.76);
  border-radius: 5px;
  background: rgba(255,255,255,0.76);
  color: #7c8498;
  font-size: 11px;
  line-height: 18px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.no-tags {
  color: #b3bac8;
  font-size: 12px;
  font-weight: 900;
}
.status-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9aa2b2;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.status-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.switch-track {
  width: 29px;
  height: 16px;
  position: relative;
  display: inline-block;
  border-radius: 999px;
  background: #d5dbe6;
  transition: background 160ms ease;
}
.switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 6px rgba(70, 78, 102, 0.18);
  transition: transform 160ms ease;
}
.status-toggle.active {
  color: #697286;
}
.status-toggle.active .switch-track {
  background: #f66fa3;
}
.status-toggle.active .switch-track::after {
  transform: translateX(13px);
}
.table-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.row-action-btn {
  height: 27px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 9px;
  border-radius: 6px;
  background: rgba(255,255,255,0.62);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.row-action-btn img {
  width: 13px;
  height: 13px;
}
.edit-action {
  border: 1px solid rgba(221, 226, 239, 0.78);
  color: #677085;
}
.delete-action {
  border: 1px solid rgba(255, 215, 223, 0.86);
  color: #f06080;
}
.image-pagination-card {
  min-height: 50px;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 290px;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
}
.pagination-total {
  color: #7c8498;
  font-size: 13px;
  font-weight: 900;
}
.page-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
}
.page-arrow,
.page-number {
  min-width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #657085;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.page-number.active {
  border-color: rgba(255, 112, 164, 0.7);
  background: rgba(255, 240, 246, 0.75);
  color: #f05f98;
}
.page-number.ellipsis {
  cursor: default;
}
.page-arrow:disabled,
.page-number:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pagination-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  color: #7c8498;
  font-size: 12px;
  font-weight: 900;
}
.page-size-select {
  width: 94px;
}
.pagination-tools input {
  width: 58px;
  height: 31px;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.72);
  color: #586176;
  text-align: center;
  font-size: 12px;
  font-weight: 900;
  outline: none;
}
.image-edit-modal {
  position: relative;
  width: 420px;
  padding: 28px 28px 25px;
  border: 1px solid rgba(255, 168, 200, 0.62);
  border-radius: 10px;
  background: rgba(255,255,255,0.9);
  box-shadow: 0 24px 64px rgba(91, 82, 118, 0.18);
  backdrop-filter: blur(24px);
}
.image-edit-close {
  position: absolute;
  top: 20px;
  right: 24px;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: #99a0b2;
  font-size: 25px;
  line-height: 20px;
  cursor: pointer;
}
.image-edit-modal h3 {
  margin: 0 0 20px;
  color: #333a4d;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
}
.image-edit-field label {
  display: block;
  margin-bottom: 8px;
  color: #4e566b;
  font-size: 13px;
  font-weight: 900;
}
.edit-tag-select {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 11px;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.68);
  color: #a0a7b8;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.edit-tag-select img {
  width: 14px;
  height: 14px;
  opacity: 0.62;
}
.edit-tag-picker {
  margin-top: 10px;
  max-height: 220px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid rgba(226, 231, 242, 0.76);
  border-radius: 8px;
  background: rgba(249, 251, 255, 0.72);
}
.selected-tags-block {
  margin-top: 18px;
}
.selected-tags-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #4e566b;
  font-size: 13px;
  font-weight: 900;
}
.selected-tags-title button {
  border: none;
  background: transparent;
  color: #ff7aa8;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.selected-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  min-height: 31px;
  margin-top: 12px;
}
.selected-tag-chip {
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid rgba(255, 184, 207, 0.76);
  border-radius: 6px;
  background: rgba(255, 240, 246, 0.82);
  color: #f05f98;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.selected-tag-chip span {
  color: #ff7aa8;
}
.empty-selected-tags {
  color: #a0a7b8;
  font-size: 12px;
  font-weight: 900;
}
.image-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 27px;
}
.edit-cancel-btn,
.edit-save-btn {
  min-width: 62px;
  height: 36px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}
.edit-cancel-btn {
  border: 1px solid rgba(216, 222, 238, 0.82);
  background: rgba(255,255,255,0.75);
  color: #697286;
}
.edit-save-btn {
  border: none;
  background: linear-gradient(135deg, #f76da1, #f35f98);
  color: white;
  box-shadow: 0 12px 24px rgba(242, 96, 151, 0.22);
}
.tag-settings-section {
  gap: 12px;
}
.tag-dashboard-card {
  border: 1px solid rgba(226, 231, 242, 0.74);
  border-radius: 9px;
  background: rgba(255,255,255,0.64);
  box-shadow: 0 16px 42px rgba(86, 96, 128, 0.07);
  backdrop-filter: blur(22px);
}
.tag-manage-card {
  overflow: hidden;
}
.tag-card-heading {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 22px;
  border-bottom: 1px solid rgba(226, 231, 242, 0.76);
  background: linear-gradient(90deg, rgba(255, 245, 250, 0.56), rgba(247, 252, 255, 0.54));
}
.tag-card-heading h2,
.manual-heading h2 {
  margin: 0;
  color: #333a4d;
  font-size: 16px;
  line-height: 1.1;
  font-weight: 900;
}
.private-tags-panel {
  margin: 18px;
  overflow: hidden;
  border: 1px solid rgba(222, 228, 240, 0.82);
  border-radius: 9px;
  background: rgba(255,255,255,0.58);
}
.private-tags-toolbar {
  height: 53px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(226, 231, 242, 0.76);
}
.private-title {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}
.private-title h3 {
  margin: 0;
  color: #333a4d;
  font-size: 15px;
  line-height: 1;
  font-weight: 900;
  white-space: nowrap;
}
.private-title span {
  color: #a1a8b8;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.private-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.private-selected-count {
  color: #6f788d;
  font-size: 12px;
  font-weight: 900;
}
.private-action-btn {
  height: 31px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 16px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.private-action-btn img {
  width: 14px;
  height: 14px;
}
.private-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.private-delete-btn {
  border: 1px solid rgba(255, 178, 201, 0.58);
  background: rgba(255, 239, 246, 0.75);
  color: #f1689a;
}
.private-create-btn {
  min-width: 106px;
  border: 1px solid rgba(255, 137, 180, 0.68);
  background: rgba(255,255,255,0.62);
  color: #f05f98;
}
.private-tags-table {
  overflow: hidden;
}
.private-tags-head,
.private-tags-row {
  display: grid;
  grid-template-columns: 42px minmax(120px, 1fr) minmax(120px, 1fr) 122px minmax(160px, 1.15fr) 146px;
  align-items: center;
  column-gap: 10px;
}
.private-tags-head {
  height: 39px;
  padding: 0 14px;
  background: rgba(249, 251, 255, 0.72);
  border-bottom: 1px solid rgba(226, 231, 242, 0.76);
  color: #788197;
  font-size: 12px;
  font-weight: 900;
}
.head-with-info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.head-with-info i,
.tag-modal-switch-row i,
.tag-modal-field label i,
.manual-overwrite-row em {
  width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(149, 159, 180, 0.55);
  border-radius: 50%;
  color: #9aa3b6;
  font-size: 9px;
  line-height: 1;
  font-style: normal;
  font-weight: 900;
  cursor: help;
}
.private-tags-body {
  min-height: 234px;
}
.private-tags-row {
  min-height: 39px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(226, 231, 242, 0.74);
  color: #657085;
  font-size: 12px;
  font-weight: 900;
}
.private-name,
.private-display,
.mutual-summary {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.private-combinable {
  text-align: center;
}
.private-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.private-row-btn {
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.private-row-btn img {
  width: 13px;
  height: 13px;
  opacity: 0.72;
}
.private-row-btn.edit {
  color: #6f788d;
}
.private-row-btn.delete {
  color: #ff7aa7;
}
.tag-empty-msg,
.manual-empty {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0a7b8;
  font-size: 12px;
  font-weight: 900;
}
.private-tags-footer {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 16px;
  color: #8e96aa;
  font-size: 12px;
  font-weight: 900;
}
.private-footer-tools,
.manual-page-nav,
.tag-page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag-page-arrow,
.tag-page-number {
  min-width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(226, 231, 242, 0.76);
  border-radius: 6px;
  background: rgba(255,255,255,0.62);
  color: #687287;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.tag-page-arrow img {
  width: 13px;
  height: 13px;
  opacity: 0.55;
}
.tag-page-number.active {
  border-color: rgba(255, 127, 174, 0.62);
  background: rgba(255, 239, 246, 0.82);
  color: #f05f98;
}
.tag-page-number.ellipsis {
  border-color: transparent;
  background: transparent;
  cursor: default;
}
.tag-page-arrow:disabled,
.tag-page-number:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.tag-page-size-select {
  width: 98px;
}
.tag-page-size-select :deep(.taotu-select-trigger),
.manual-filter-select :deep(.taotu-select-trigger) {
  min-height: 31px;
  height: 31px;
  border-radius: 7px;
  background: rgba(255,255,255,0.68);
  box-shadow: none;
  font-size: 12px;
}
.tag-page-size-select :deep(.taotu-select-value),
.manual-filter-select :deep(.taotu-select-value) {
  font-size: 12px;
  font-weight: 900;
  color: #5d667b;
}
.manual-tag-card {
  padding: 18px 18px 16px;
}
.manual-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 368px;
  gap: 24px;
  align-items: start;
}
.manual-heading {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 22px;
  margin-bottom: 14px;
}
.manual-heading span {
  color: #a1a8b8;
  font-size: 11px;
  font-weight: 900;
}
.manual-filter-row {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 10px;
}
.manual-filter-field {
  display: flex;
  align-items: center;
  gap: 9px;
}
.manual-filter-field > span {
  color: #6f788d;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}
.manual-source-field {
  min-width: 202px;
}
.manual-album-field {
  min-width: 228px;
}
.manual-static-select {
  width: 126px;
  height: 31px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px 0 13px;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.68);
  color: #5d667b;
  font-size: 12px;
  font-weight: 900;
  cursor: default;
}
.manual-static-select img {
  width: 13px;
  height: 13px;
  opacity: 0.58;
}
.manual-filter-select {
  width: 136px;
}
.manual-album-field .manual-filter-select {
  width: 162px;
}
.manual-select-line {
  margin-bottom: 8px;
  color: #7f879a;
  font-size: 12px;
  font-weight: 900;
}
.manual-image-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(118px, 1fr));
  gap: 10px 14px;
  min-height: 188px;
}
.manual-image-card {
  position: relative;
  aspect-ratio: 1.72 / 1;
  overflow: hidden;
  padding: 0;
  border: 2px solid rgba(226, 231, 242, 0.84);
  border-radius: 7px;
  background: rgba(241, 245, 251, 0.9);
  cursor: pointer;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.72);
}
.manual-image-card img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.manual-image-card.selected {
  border-color: #ff7aa7;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.85), 0 8px 18px rgba(242, 96, 151, 0.14);
}
.manual-check-mark {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background: #ff78a5;
  color: #fff;
  font-size: 14px;
  line-height: 1;
  font-weight: 900;
  box-shadow: 0 6px 12px rgba(242, 96, 151, 0.22);
}
.manual-pagination-row {
  height: 38px;
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 110px;
  align-items: center;
  gap: 12px;
  margin-top: 11px;
  color: #8e96aa;
  font-size: 12px;
  font-weight: 900;
}
.manual-page-nav {
  justify-content: center;
}
.manual-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.manual-side-card {
  padding: 20px 18px;
  border: 1px solid rgba(226, 231, 242, 0.82);
  border-radius: 9px;
  background: rgba(255,255,255,0.62);
  box-shadow: 0 12px 30px rgba(86, 96, 128, 0.06);
}
.manual-side-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.manual-side-title h3 {
  margin: 0;
  color: #333a4d;
  font-size: 13px;
  line-height: 1;
  font-weight: 900;
}
.manual-side-title h3 span {
  color: #a1a8b8;
}
.manual-side-title button {
  border: none;
  background: transparent;
  color: #b1b8c8;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.manual-tag-input {
  height: 33px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 12px;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.68);
}
.manual-tag-input input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #4f586d;
  font-size: 12px;
  font-weight: 900;
}
.manual-tag-input input::placeholder {
  color: #a8afbf;
}
.manual-tag-input img {
  width: 13px;
  height: 13px;
  opacity: 0.58;
}
.manual-select-card > p {
  margin: 13px 0 12px;
  color: #8f97aa;
  font-size: 12px;
  font-weight: 900;
}
.manual-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 29px;
}
.manual-tag-chip {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid rgba(255, 187, 210, 0.75);
  border-radius: 6px;
  background: rgba(255, 239, 246, 0.85);
  color: #f05f98;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.manual-tag-chip span {
  color: #ff7aa7;
}
.manual-empty-chip {
  color: #a8afbf;
  font-size: 12px;
  font-weight: 900;
}
.manual-overwrite-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #3f4659;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}
.manual-check-box {
  width: 16px;
  height: 16px;
  position: relative;
  display: inline-flex;
}
.manual-check-box input {
  position: absolute;
  opacity: 0;
}
.manual-check-box i {
  width: 14px;
  height: 14px;
  display: block;
  border: 1px solid rgba(255, 126, 174, 0.74);
  border-radius: 4px;
  background: rgba(255,255,255,0.7);
}
.manual-check-box input:checked + i {
  background: #ff78a5;
  border-color: #ff78a5;
}
.manual-check-box input:checked + i::after {
  content: '✓';
  display: block;
  color: #fff;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  font-weight: 900;
}
.manual-run-card > p {
  margin: 7px 0 16px 24px;
  color: #a0a7b8;
  font-size: 11px;
  font-weight: 900;
}
.manual-run-btn {
  width: 100%;
  height: 39px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: none;
  border-radius: 7px;
  background: linear-gradient(135deg, #f75c98, #ff91b8);
  color: white;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(242, 96, 151, 0.2);
}
.manual-run-btn:disabled {
  opacity: 0.52;
  cursor: not-allowed;
}
.manual-run-btn span {
  font-size: 15px;
}
.manual-run-card small {
  display: block;
  margin-top: 12px;
  color: #a0a7b8;
  text-align: center;
  font-size: 11px;
  font-weight: 900;
}
.manual-result {
  margin: 10px 0 0 !important;
  text-align: center;
}
.tag-edit-modal {
  position: relative;
  width: 365px;
  padding: 26px 28px 31px;
  border: 1px solid rgba(226, 231, 242, 0.78);
  border-radius: 10px;
  background: rgba(255,255,255,0.92);
  box-shadow: 0 24px 64px rgba(91, 82, 118, 0.18);
  backdrop-filter: blur(24px);
}
.tag-modal-close {
  position: absolute;
  top: 17px;
  right: 18px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #98a0b3;
  font-size: 24px;
  line-height: 20px;
  cursor: pointer;
}
.tag-edit-modal h3 {
  margin: 0 0 17px;
  color: #333a4d;
  font-size: 16px;
  line-height: 1.1;
  font-weight: 900;
}
.tag-modal-field {
  margin-bottom: 14px;
}
.tag-modal-field label,
.tag-modal-switch-row span {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  color: #4e566b;
  font-size: 12px;
  font-weight: 900;
}
.tag-modal-field label span {
  color: #ff6d9f;
}
.tag-modal-input,
.tag-mutual-select {
  height: 33px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.68);
}
.tag-modal-input input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #4f586d;
  font-size: 12px;
  font-weight: 900;
}
.tag-modal-input input::placeholder {
  color: #b0b7c6;
}
.tag-modal-input input:disabled {
  color: #8e96aa;
}
.tag-modal-input em {
  flex-shrink: 0;
  color: #a3aabc;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}
.tag-modal-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 15px 0 15px;
}
.tag-modal-switch-row span {
  margin: 0;
}
.tag-switch {
  width: 34px;
  height: 18px;
  position: relative;
  display: inline-flex;
  border-radius: 999px;
  background: #d5dbe6;
  cursor: pointer;
  transition: background 160ms ease;
}
.tag-switch input {
  position: absolute;
  opacity: 0;
}
.tag-switch i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(70, 78, 102, 0.18);
  transition: transform 160ms ease;
}
.tag-switch.active {
  background: #ff78a5;
}
.tag-switch.active i {
  transform: translateX(16px);
}
.tag-mutual-select {
  justify-content: space-between;
  color: #a4abba;
  font-size: 12px;
  font-weight: 900;
}
.tag-mutual-select img {
  width: 13px;
  height: 13px;
  opacity: 0.58;
}
.tag-mutual-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  max-height: 92px;
  overflow-y: auto;
  margin-top: 9px;
}
.tag-mutual-chip {
  height: 24px;
  padding: 0 10px;
  border: 1px solid rgba(226, 231, 242, 0.82);
  border-radius: 6px;
  background: rgba(255,255,255,0.72);
  color: #737c91;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.tag-mutual-chip.selected {
  border-color: rgba(255, 154, 192, 0.7);
  background: rgba(255, 239, 246, 0.84);
  color: #f05f98;
}
.tag-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 20px;
}
.tag-cancel-btn,
.tag-save-btn {
  min-width: 82px;
  height: 36px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}
.tag-cancel-btn {
  border: 1px solid rgba(216, 222, 238, 0.82);
  background: rgba(255,255,255,0.75);
  color: #697286;
}
.tag-save-btn {
  border: none;
  background: linear-gradient(135deg, #f76da1, #f35f98);
  color: white;
  box-shadow: 0 12px 24px rgba(242, 96, 151, 0.22);
}
.security-section {
  gap: 14px;
}
.security-top-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.24fr);
  gap: 18px;
}
.security-card {
  border: 1px solid rgba(226, 231, 242, 0.74);
  border-radius: 10px;
  background: rgba(255,255,255,0.66);
  box-shadow: 0 18px 48px rgba(86, 96, 128, 0.08);
  backdrop-filter: blur(22px);
}
.account-info-card {
  min-height: 304px;
  padding: 24px 26px 25px;
}
.security-card h2 {
  margin: 0;
  color: #343b50;
  font-size: 16px;
  line-height: 1.1;
  font-weight: 900;
}
.account-profile-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 22px;
  margin-top: 21px;
}
.security-avatar {
  position: relative;
  width: 92px;
  height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid rgba(255, 147, 186, 0.58);
  border-radius: 50%;
  background: linear-gradient(135deg, #ff91b9, #a88cff);
  color: #fff;
  font-size: 30px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 13px 28px rgba(248,95,154,0.16);
}
.security-avatar img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.avatar-hover-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: rgba(28, 34, 50, 0.48);
  color: #fff;
  opacity: 0;
  transition: opacity 160ms ease;
}
.security-avatar:hover .avatar-hover-layer {
  opacity: 1;
}
.avatar-hover-layer strong {
  font-size: 25px;
  line-height: 1;
  font-weight: 600;
}
.avatar-hover-layer em {
  font-size: 12px;
  line-height: 1;
  font-style: normal;
  font-weight: 900;
}
.account-profile-copy {
  min-width: 0;
}
.account-profile-copy h3 {
  margin: 0;
  color: #343b50;
  font-size: 19px;
  line-height: 1.2;
  font-weight: 900;
}
.account-profile-copy p {
  margin: 7px 0 9px;
  color: #8c94a7;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 900;
}
.account-profile-copy > span {
  display: inline-flex;
  align-items: center;
  min-height: 25px;
  padding: 0 12px;
  border-radius: 7px;
  background: rgba(255, 235, 244, 0.84);
  color: #f05f98;
  font-size: 12px;
  font-weight: 900;
}
.account-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 32px;
}
.account-stat-box {
  min-height: 88px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  padding: 0 20px;
  border: 1px solid rgba(226, 231, 242, 0.82);
  border-radius: 8px;
  background: rgba(255,255,255,0.52);
}
.account-stat-box span {
  color: #9ba3b4;
  font-size: 12px;
  font-weight: 900;
}
.account-stat-box strong {
  color: #3d455a;
  font-size: 18px;
  line-height: 1.12;
  font-weight: 900;
}
.avatar-feedback {
  margin: 12px 0 0;
  font-size: 12px;
  font-weight: 900;
}
.avatar-feedback.success {
  color: #43b69d;
}
.avatar-feedback.error {
  color: #f25f7d;
}
.password-security-card {
  min-height: 304px;
  padding: 24px 18px 20px 20px;
}
.password-card-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(240px, 0.88fr);
  gap: 26px;
  align-items: start;
  margin-top: 19px;
}
.password-form-panel {
  padding-right: 2px;
}
.password-field {
  display: block;
  margin-bottom: 12px;
}
.password-field > span {
  display: block;
  margin-bottom: 8px;
  color: #7d8598;
  font-size: 12px;
  font-weight: 900;
}
.password-field input {
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.62);
  outline: none;
  color: #3f465a;
  font-size: 12px;
  font-weight: 900;
}
.password-field > input {
  padding: 0 12px;
}
.password-field input::placeholder {
  color: #b1b8c7;
}
.password-input-wrap {
  height: 32px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  align-items: center;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.62);
}
.password-input-wrap input {
  height: 30px;
  padding: 0 0 0 12px;
  border: none;
  background: transparent;
}
.password-input-wrap button {
  width: 32px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
}
.password-input-wrap img {
  width: 15px;
  height: 15px;
  opacity: 0.54;
}
.change-password-btn {
  min-width: 91px;
  height: 32px;
  margin-top: 3px;
  border: none;
  border-radius: 7px;
  background: linear-gradient(135deg, #f75c98, #ff7cad);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(242, 96, 151, 0.2);
}
.change-password-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.password-notice-panel {
  min-height: 215px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  padding-left: 20px;
  border-left: 1px solid rgba(226, 231, 242, 0.78);
}
.password-notice {
  position: relative;
  min-height: 66px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 14px 16px;
  border-radius: 10px;
}
.password-notice.success {
  border: 1px solid rgba(86, 206, 176, 0.55);
  background: rgba(238, 255, 250, 0.72);
}
.password-notice.error {
  border: 1px solid rgba(255, 151, 171, 0.58);
  background: rgba(255, 244, 247, 0.74);
}
.notice-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 17px;
  line-height: 1;
  font-weight: 900;
}
.password-notice.success .notice-icon {
  background: #48c4a8;
}
.password-notice.error .notice-icon {
  background: #f95f78;
}
.password-notice strong {
  display: block;
  color: #4c566a;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 900;
}
.password-notice p {
  margin: 5px 0 0;
  color: #788197;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 900;
}
.password-notice small {
  display: block;
  margin-top: 8px;
  color: #9da5b6;
  font-size: 11px;
  font-weight: 900;
}
.password-notice > button {
  position: absolute;
  top: 12px;
  right: 14px;
  border: none;
  background: transparent;
  color: #9ba3b4;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.api-token-security-card {
  min-height: 386px;
  padding: 23px 24px 18px;
}
.api-token-heading h2 {
  margin: 0;
  color: #343b50;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 900;
}
.api-token-heading h2 span {
  font-size: 15px;
}
.api-token-heading p {
  margin: 9px 0px;
  color: #8c94a7;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 900;
}
.token-create-button {
  height: 31px;
  min-width: 110px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 15px;
  border: none;
  border-radius: 7px;
  background: linear-gradient(135deg, #9f83ff, #bd9bff);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(154, 120, 244, 0.2);
  margin: 13px 0px;
}
.token-create-button img {
  width: 14px;
  height: 14px;
  filter: brightness(0) invert(1);
}
.new-token-warning {
  position: relative;
  margin: 16px 0 18px;
  padding: 16px 20px 17px 34px;
  border: 1px solid rgba(255, 176, 82, 0.62);
  border-radius: 9px;
  background: rgba(255, 250, 238, 0.74);
}
.new-token-close {
  position: absolute;
  top: 16px;
  right: 18px;
  border: none;
  background: transparent;
  color: #9ca4b5;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.new-token-title {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #e78b35;
  font-size: 13px;
  font-weight: 900;
}
.bulb-placeholder {
  width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #f0a23d;
  font-size: 15px;
}
.new-token-warning p {
  margin: 7px 0 10px 26px;
  color: #8b94a8;
  font-size: 12px;
  font-weight: 900;
}
.new-token-value {
  height: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 58px;
  align-items: center;
  margin-left: 0;
  border: 1px solid rgba(183, 163, 255, 0.5);
  border-radius: 7px;
  background: rgba(248, 245, 255, 0.82);
}
.new-token-value code {
  min-width: 0;
  padding: 0 14px;
  overflow: hidden;
  color: #9b7dff;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.new-token-value button {
  height: 24px;
  margin-right: 7px;
  border: none;
  border-radius: 5px;
  background: rgba(171, 145, 255, 0.16);
  color: #a586ff;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.token-table {
  overflow: hidden;
  border: 1px solid rgba(226, 231, 242, 0.78);
  border-radius: 9px;
  background: rgba(255,255,255,0.42);
}
.token-table-head,
.token-table-row {
  display: grid;
  grid-template-columns: minmax(150px, 1.1fr) minmax(170px, 1.12fr) minmax(160px, 1fr) minmax(150px, 1fr) 90px 82px;
  align-items: center;
  column-gap: 12px;
}
.token-table-head {
  height: 37px;
  padding: 0 14px;
  background: rgba(249, 251, 255, 0.75);
  border-bottom: 1px solid rgba(226, 231, 242, 0.76);
  color: #8a92a6;
  font-size: 12px;
  font-weight: 900;
}
.token-table-body {
  min-height: 120px;
}
.token-table-row {
  min-height: 39px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(226, 231, 242, 0.74);
  color: #7b8498;
  font-size: 12px;
  font-weight: 900;
}
.token-table-row > span {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.token-name {
  color: #5e687c;
}
.token-masked {
  color: #8c94a7;
  letter-spacing: 0;
}
.token-status {
  min-width: 46px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(224, 250, 239, 0.82);
  color: #4cbd8f;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}
.token-actions {
  text-align: right;
}
.token-actions button {
  height: 24px;
  padding: 0 10px;
  border: 1px solid rgba(255, 197, 212, 0.62);
  border-radius: 6px;
  background: rgba(255, 239, 246, 0.82);
  color: #ff6b98;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}
.token-empty {
  min-height: 118px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0a7b8;
  font-size: 12px;
  font-weight: 900;
}
.token-table-footer {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 14px;
  color: #8e96aa;
  font-size: 12px;
  font-weight: 900;
}
.token-page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.token-create-modal {
  position: relative;
  width: 326px;
  padding: 28px 28px 31px;
  border: 1px solid rgba(226, 231, 242, 0.78);
  border-radius: 10px;
  background: rgba(255,255,255,0.93);
  box-shadow: 0 24px 64px rgba(91, 82, 118, 0.18);
  backdrop-filter: blur(24px);
}
.token-modal-close {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #98a0b3;
  font-size: 24px;
  line-height: 20px;
  cursor: pointer;
}
.token-create-modal h3 {
  margin: 0 0 27px;
  color: #333a4d;
  font-size: 16px;
  line-height: 1.1;
  font-weight: 900;
}
.token-modal-field label {
  display: block;
  margin-bottom: 10px;
  color: #6d768b;
  font-size: 12px;
  font-weight: 900;
}
.token-modal-input {
  height: 33px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid rgba(216, 222, 238, 0.82);
  border-radius: 7px;
  background: rgba(255,255,255,0.68);
}
.token-modal-input input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #4f586d;
  font-size: 12px;
  font-weight: 900;
}
.token-modal-input input::placeholder {
  color: #b0b7c6;
}
.token-modal-input em {
  flex-shrink: 0;
  color: #a3aabc;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}
.token-modal-divider {
  height: 1px;
  margin: 31px -28px 22px;
  background: rgba(226, 231, 242, 0.72);
}
.token-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
}
.token-cancel-btn,
.token-save-btn {
  min-width: 82px;
  height: 36px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}
.token-cancel-btn {
  border: 1px solid rgba(216, 222, 238, 0.82);
  background: rgba(255,255,255,0.75);
  color: #697286;
}
.token-save-btn {
  border: none;
  background: linear-gradient(135deg, #b794ff, #a883ff);
  color: white;
  box-shadow: 0 12px 24px rgba(154, 120, 244, 0.22);
}
.management-panel { padding: var(--space-lg); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); gap: var(--space-md); }
.section-actions { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
.section-header h3 { color: var(--taotu-text-strong); font-size: 17px; font-weight: 900; margin: 0; }
.image-toolbar, .manual-filters { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-lg); }
.source-pill { padding: 7px 12px; border-radius: 999px; background: var(--fluent-blue-light); color: var(--fluent-blue); font-size: 12px; font-weight: 900; }
.multi-toggle.active { background: var(--fluent-blue-light); color: var(--fluent-blue); border-color: var(--fluent-blue); }
.inline-count { margin-left: 0; }
.more-filters { margin-bottom: var(--space-lg); padding: var(--space-md); border: 1px solid var(--fluent-border); border-radius: var(--taotu-radius-md); background: rgba(255,240,246,0.58); }
.more-filters > label { display: block; font-size: 13px; font-weight: 900; margin-bottom: var(--space-sm); }
.batch-bar { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-lg); padding: var(--space-sm) var(--space-md); border: 1px solid var(--fluent-border); border-radius: var(--taotu-radius-md); background: rgba(238,250,255,0.66); }
.toolbar-select { width: 170px; }
.search-input { width: 220px; }
.image-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.image-row { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); border: 1px solid var(--fluent-border); border-radius: var(--taotu-radius-md); background: rgba(255,255,255,0.46); }
.image-row.selected { border-color: var(--fluent-blue); background: var(--fluent-blue-light); }
.row-checkbox { width: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.row-thumb { width: 68px; height: 68px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--fluent-hover); }
.row-thumb img { width: 100%; height: 100%; object-fit: cover; }
.row-main { flex: 1; min-width: 0; }
.row-title { color: var(--taotu-text-strong); font-size: 14px; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.row-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.tag-mini { font-size: 11px; padding: 1px 7px; background: var(--fluent-blue-light); color: var(--fluent-blue); border-radius: 999px; font-weight: 800; }
.row-actions { display: flex; gap: 6px; align-items: center; }
.compact-actions { justify-content: flex-end; white-space: nowrap; }
.public-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--fluent-text-secondary); cursor: pointer; }
.public-toggle input { margin: 0; }
.delete-btn { color: #d13438; }
.delete-btn:hover { background: #fde7e9; }
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-md); padding-top: var(--space-lg); font-size: 13px; color: var(--fluent-text-secondary); }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.56); border: 1px solid var(--taotu-border); border-radius: 999px; padding: 4px; width: fit-content; }
.compact-tabs { margin-bottom: 0; }
.tab-btn { padding: 8px 18px; border: none; background: transparent; border-radius: 999px; color: var(--taotu-text-muted); cursor: pointer; font-size: 14px; font-weight: 900; }
.tab-btn.active { background: white; color: var(--taotu-pink); box-shadow: var(--shadow-1); }
.tag-table { border: 1px solid var(--fluent-border); border-radius: var(--taotu-radius-md); overflow: hidden; background: rgba(255,255,255,0.45); }
.private-table-header, .private-table-row { display: grid; grid-template-columns: 34px 1fr 1fr 90px 1.2fr 160px; gap: var(--space-sm); padding: 9px 14px; align-items: center; }
.private-table-header { background: rgba(255,240,246,0.75); color: var(--taotu-text-muted); font-size: 13px; font-weight: 900; }
.private-table-row { border-top: 1px solid var(--fluent-border); font-size: 13px; }
.mutual-summary { color: var(--fluent-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mutual-picker { display: flex; flex-wrap: wrap; gap: 6px; padding: var(--space-sm); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); background: var(--fluent-hover); }
.mutual-chip { padding: 4px 10px; border: 1px solid var(--fluent-border); border-radius: 999px; background: white; font-size: 12px; font-weight: 800; cursor: pointer; }
.mutual-chip.selected { background: var(--fluent-blue); border-color: var(--fluent-blue); color: white; }
.empty-inline { font-size: 12px; color: var(--fluent-text-secondary); }
.manual-grid { display: grid; grid-template-columns: repeat(auto-fill, 216px); gap: var(--space-md); align-items: start; }
.manual-card { width: 216px; cursor: pointer; border: 2px solid transparent; border-radius: var(--taotu-radius-md); padding: var(--space-sm); transition: all var(--transition-fast); box-sizing: border-box; background: rgba(255,255,255,0.42); }
.manual-card:hover { border-color: var(--fluent-border); }
.manual-card.selected { border-color: var(--fluent-blue); background: var(--fluent-blue-light); }
.manual-thumb { width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; background: var(--fluent-hover); border-radius: var(--radius-sm); overflow: hidden; position: relative; }
.manual-thumb img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
.check-mark { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; background: var(--fluent-blue); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; }
.manual-name { width: 200px; margin-top: var(--space-xs); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.selected-count { margin-left: auto; font-size: 13px; color: var(--fluent-blue); font-weight: 500; }
.selected-count.inline-count { margin-left: 0; }
.manual-action { margin-top: var(--space-xl); padding: var(--space-lg); border: 1px solid var(--fluent-border); border-radius: var(--taotu-radius-md); background: rgba(255,240,246,0.46); display: flex; flex-direction: column; gap: var(--space-md); }
.overwrite-toggle { width: fit-content; }
.token-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.token-item, .album-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--fluent-border); }
.token-info, .album-row > div { display: flex; flex-direction: column; gap: 3px; }
.account-grid { display: grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: var(--space-lg); }
.account-panel h3 { color: var(--taotu-text-strong); font-size: 17px; font-weight: 900; margin: 0 0 var(--space-lg); }
.account-avatar-area { display: flex; justify-content: center; margin: 2px 0 var(--space-lg); }
.account-avatar { width: 92px; height: 92px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(255,255,255,0.76); border-radius: 24px; background: linear-gradient(135deg, var(--taotu-pink), var(--taotu-purple)); color: white; font-size: 30px; font-weight: 900; box-shadow: 0 16px 34px rgba(248,95,154,0.18); }
.account-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hidden-file { display: none; }
.account-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--fluent-border); font-size: 14px; }
.account-row span { color: var(--fluent-text-secondary); }
.avatar-upload-btn { width: 100%; margin-top: var(--space-lg); }
.password-btn { width: 100%; }
.password-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.account-msg { margin-top: var(--space-md); margin-bottom: 0; }
.error-msg { color: #d13438; font-size: 13px; }
.token-label { font-weight: 500; font-size: 14px; }
.token-date, .album-row span { font-size: 12px; color: var(--fluent-text-secondary); }
.new-token-box { margin-top: var(--space-lg); padding: var(--space-md); background: rgba(255,244,206,0.82); border-radius: var(--radius-sm); }
.new-token-box code { display: block; word-break: break-all; font-size: 12px; margin: var(--space-sm) 0; }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.inline-check label { display: flex; align-items: center; gap: 6px; }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.modal { width: 420px; padding: var(--space-xl); max-height: 82vh; overflow-y: auto; background: rgba(255,255,255,0.9); }
.wide-modal { width: 560px; }
.modal h3 { margin-bottom: var(--space-lg); }
.edit-preview { display: flex; gap: var(--space-md); align-items: center; margin-bottom: var(--space-lg); padding-bottom: var(--space-lg); border-bottom: 1px solid var(--fluent-border); }
.edit-preview img { width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-sm); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
@media (max-width: 1240px) {
  .dashboard-shell {
    grid-template-columns: 224px minmax(0, 1fr);
  }
  .image-filter-card {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .image-search-btn {
    width: 120px;
  }
  .image-table-head,
  .image-table-row {
    grid-template-columns: 38px 118px minmax(150px, 1fr) minmax(150px, 1fr) minmax(170px, 1fr) 112px 132px;
  }
  .table-thumb {
    width: 92px;
    height: 46px;
  }
  .image-pagination-card {
    grid-template-columns: 160px minmax(0, 1fr);
  }
  .pagination-tools {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .overview-main-grid {
    grid-template-columns: 1fr;
  }
  .overview-side-stack {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .recent-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .storage-content {
    grid-template-columns: 128px minmax(0, 1fr);
    gap: 14px;
  }
  .storage-ring {
    width: 124px;
    height: 124px;
  }
}
@media (max-width: 900px) {
  .dashboard-shell { grid-template-columns: 1fr; }
  .dashboard-sidebar { position: static; min-height: auto; }
  .dashboard-nav { flex-direction: row; flex-wrap: wrap; }
  .nav-item { width: auto; min-width: 126px; }
  .image-filter-card {
    grid-template-columns: 1fr;
  }
  .filter-field {
    grid-template-columns: 48px minmax(0, 1fr);
  }
  .image-table-card {
    overflow-x: auto;
  }
  .image-table-head,
  .image-table-row {
    min-width: 900px;
  }
  .image-pagination-card {
    grid-template-columns: 1fr;
  }
  .pagination-total,
  .pagination-tools {
    justify-content: center;
    text-align: center;
  }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .quick-actions { grid-template-columns: 1fr; }
  .overview-side-stack { grid-template-columns: 1fr; }
  .recent-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .row-actions { flex-wrap: wrap; justify-content: flex-end; }
  .manual-grid { grid-template-columns: repeat(auto-fill, minmax(216px, 1fr)); }
  .manual-card { justify-self: center; }
  .account-grid { grid-template-columns: 1fr; }
  .modal, .wide-modal { width: min(92vw, 560px); }
}
@media (max-width: 640px) {
  .dashboard-page { padding-left: 10px; padding-right: 10px; }
  .profile-block { grid-template-columns: 50px minmax(0, 1fr); padding-left: 8px; padding-right: 8px; }
  .avatar-mark { width: 50px; height: 50px; }
  .stats-row { grid-template-columns: 1fr; }
  .stat-card { grid-template-columns: 56px minmax(0, 1fr); padding: 14px; }
  .recent-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .storage-content { grid-template-columns: 1fr; justify-items: center; }
  .storage-legend { width: 100%; }
  .image-edit-modal { width: min(92vw, 420px); padding: 24px 20px 22px; }
}
</style>
