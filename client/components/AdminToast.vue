<template>
  <Teleport to="body">
    <Transition name="admin-toast">
      <div
        v-if="toast.visible"
        class="admin-toast-pill"
        :class="toast.type"
        role="status"
        aria-live="polite"
      >
        <TaotuIcon class="toast-icon" :name="iconName" filled :stateful="false" />
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const { toast } = useAdminToast()

const iconName = computed(() => {
  if (toast.value.type === 'success') return 'toast-success'
  if (toast.value.type === 'error' || toast.value.type === 'danger') return 'toast-error'
  if (toast.value.type === 'warning') return 'toast-warning'
  return 'toast-info'
})
</script>

<style scoped>
.admin-toast-pill {
  --toast-bg: rgba(239, 246, 255, 0.92);
  --toast-border: rgba(166, 178, 210, 0.32);
  --toast-color: #4d75c8;
  position: fixed;
  top: 84px;
  left: 50%;
  z-index: 3000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(720px, calc(100vw - 32px));
  min-height: 38px;
  padding: 8px 18px 8px 12px;
  border: 1px solid var(--toast-border);
  border-radius: 999px;
  background: var(--toast-bg);
  color: var(--toast-color);
  box-shadow: 0 18px 42px rgba(84, 74, 118, 0.16);
  backdrop-filter: blur(18px);
  transform: translateX(-50%);
  pointer-events: none;
}

.admin-toast-pill.success {
  --toast-bg: rgba(236, 255, 248, 0.94);
  --toast-border: rgba(77, 203, 155, 0.34);
  --toast-color: #28a977;
}

.admin-toast-pill.error,
.admin-toast-pill.danger {
  --toast-bg: rgba(255, 241, 246, 0.95);
  --toast-border: rgba(248, 95, 132, 0.34);
  --toast-color: #df5472;
}

.admin-toast-pill.warning {
  --toast-bg: color-mix(in srgb, var(--taotu-warning-soft) 88%, white);
  --toast-border: rgba(245, 180, 93, 0.38);
  --toast-color: #d69a35;
}

.toast-icon {
  width: 22px;
  height: 22px;
  color: var(--toast-color);
  flex: 0 0 auto;
}

.toast-message {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0;
}

.admin-toast-enter-active,
.admin-toast-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.admin-toast-enter-from,
.admin-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

.admin-toast-enter-to,
.admin-toast-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}
</style>
