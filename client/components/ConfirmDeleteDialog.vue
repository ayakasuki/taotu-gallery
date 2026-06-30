<template>
  <Teleport to="body">
    <div v-if="show" class="confirm-layer" @click.self="$emit('cancel')">
      <section class="confirm-card">
      <header class="confirm-head">
        <div class="confirm-title">
          <span class="warn-mark">!</span>
          <h2>{{ title }}</h2>
        </div>
        <button type="button" class="close-btn" @click="$emit('cancel')">
          <img :src="closeIcon" alt="" />
        </button>
      </header>

      <div v-if="avatarText || avatarIcon" class="confirm-avatar">
        <img v-if="avatarIcon" :src="avatarIcon" alt="" />
        <span v-else>{{ avatarText }}</span>
      </div>

      <h3>{{ message }}</h3>
      <p v-if="description" class="confirm-desc">{{ description }}</p>

      <div v-if="effects.length" class="effect-box">
        <strong>{{ effectTitle }}</strong>
        <ul>
          <li v-for="item in effects" :key="item">{{ item }}</li>
        </ul>
      </div>

      <footer class="confirm-actions">
        <button type="button" class="cancel-action" :disabled="loading" @click="$emit('cancel')">{{ cancelText }}</button>
        <button type="button" class="danger-action" :disabled="loading" @click="$emit('confirm')">
          {{ loading ? loadingText : confirmText }}
        </button>
      </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '确认删除' },
  message: { type: String, default: '确定要删除该项目吗？' },
  description: { type: String, default: '此操作不可恢复，请谨慎操作。' },
  effectTitle: { type: String, default: '删除影响' },
  effects: { type: Array, default: () => [] },
  avatarText: { type: String, default: '' },
  avatarIcon: { type: String, default: '' },
  closeIcon: { type: String, default: '/icons/actions/close-64x64.png' },
  confirmText: { type: String, default: '确认删除' },
  cancelText: { type: String, default: '取消' },
  loadingText: { type: String, default: '处理中...' },
  loading: { type: Boolean, default: false }
})

defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.confirm-layer {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(58, 62, 82, 0.22);
  backdrop-filter: blur(10px);
}
.confirm-card {
  width: min(492px, 92vw);
  padding: 22px 22px 18px;
  border: 1px solid rgba(255, 157, 190, 0.72);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255, 246, 250, 0.92));
  box-shadow: 0 26px 80px rgba(68, 60, 88, 0.24);
}
.confirm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.confirm-title { display: inline-flex; align-items: center; gap: 10px; }
.warn-mark {
  width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid #ff5f98; border-radius: 50%; color: #ff5f98; font-weight: 900; line-height: 1;
}
.confirm-title h2 { margin: 0; color: #ff5f98; font-size: 20px; font-weight: 900; }
.close-btn { width: 26px; height: 26px; border: 0; border-radius: 6px; background: rgba(213, 255, 179, 0.72); cursor: pointer; }
.close-btn img { width: 14px; height: 14px; object-fit: contain; }
.confirm-avatar {
  width: 78px; height: 78px; display: grid; place-items: center; margin: 20px auto 16px;
  border: 12px solid rgba(255, 228, 239, 0.9); border-radius: 50%; background: linear-gradient(135deg, #83d5ff, #8f9dff); color: #fff; font-size: 24px; font-weight: 900;
}
.confirm-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.confirm-card h3 { margin: 0; color: #4a5368; text-align: center; font-size: 18px; font-weight: 900; }
.confirm-desc { margin: 8px 0 0; color: #9aa4b8; text-align: center; font-size: 13px; font-weight: 900; }
.effect-box { margin-top: 18px; padding: 15px 17px; border: 1px solid rgba(255, 157, 190, 0.52); border-radius: 9px; background: rgba(255, 244, 248, 0.82); }
.effect-box strong { display: block; margin-bottom: 8px; color: #ff5f98; font-size: 14px; font-weight: 900; }
.effect-box ul { margin: 0; padding-left: 18px; color: #6f7b95; font-size: 13px; font-weight: 800; line-height: 1.7; }
.confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; padding: 0 20px; }
.cancel-action, .danger-action { height: 46px; border-radius: 9px; cursor: pointer; font-size: 15px; font-weight: 900; }
.cancel-action { border: 1px solid rgba(217, 226, 240, 0.96); background: rgba(255,255,255,0.88); color: #8b96aa; }
.danger-action { border: 0; background: linear-gradient(135deg, #ff6f9d, #ff4d83); color: #fff; box-shadow: 0 14px 28px rgba(255, 95, 152, 0.22); }
.cancel-action:disabled, .danger-action:disabled { cursor: not-allowed; opacity: 0.62; }
</style>
