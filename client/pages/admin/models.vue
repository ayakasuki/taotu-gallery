<template>
  <div class="admin-models">
    <h1 class="page-title">模型管理</h1>
    <div class="fluent-card notice-card">
      <span class="notice-icon">ℹ️</span>
      <div>
        <h3>AI 标签功能暂未启用</h3>
        <p>计划接入远程视觉大模型（如硅基流动多模态模型），当前所有模型操作为桩实现。</p>
      </div>
    </div>
    <div class="fluent-card" style="margin-top: var(--space-lg);">
      <div class="section-header"><h3>模型列表</h3></div>
      <div class="empty-msg">暂无模型记录。AI 功能启用后可在此管理本地/远程模型。</div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.notice-card { display: flex; gap: var(--space-md); align-items: flex-start; background: #fff4ce; border: 1px solid #fce100; }
.notice-icon { font-size: 24px; }
.notice-card h3 { font-size: 15px; margin-bottom: 4px; }
.notice-card p { font-size: 13px; color: var(--fluent-text-secondary); }
.section-header { margin-bottom: var(--space-lg); }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
</style>
