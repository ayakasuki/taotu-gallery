<template>
  <div ref="rootRef" class="taotu-select" :class="{ open, disabled }">
    <button
      ref="triggerRef"
      type="button"
      class="taotu-select-trigger"
      :disabled="disabled"
      @click="toggle"
      @keydown.down.prevent="openMenu"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="taotu-select-value" :class="{ placeholder: !selectedOption }">{{ selectedLabel }}</span>
      <img
        src="/icons/nav/chevron-down-64x64.png"
        class="taotu-select-caret"
        :class="{ open }"
        alt=""
      />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="taotu-select-menu"
        :style="menuStyle"
      >
        <button
          v-for="option in normalizedOptions"
          :key="option.key"
          type="button"
          class="taotu-select-option"
          :class="{ selected: isSelected(option.value), disabled: option.disabled }"
          :disabled="option.disabled"
          @click="selectOption(option)"
        >
          <span class="option-label">{{ option.label }}</span>
          <span v-if="option.count !== undefined && option.count !== null" class="option-count">{{ option.count }}</span>
          <span v-if="isSelected(option.value)" class="option-check">
            <img src="/icons/status/success-64x64.png" alt="" />
          </span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: [String, Number, Boolean, null], default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  minWidth: { type: Number, default: 0 }
})

const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const triggerRef = ref(null)
const menuRef = ref(null)
const open = ref(false)
const menuStyle = ref({})

const normalizedOptions = computed(() => props.options.map((option, index) => {
  if (typeof option === 'string' || typeof option === 'number') {
    return {
      key: `${option}-${index}`,
      label: String(option),
      value: option,
      disabled: false
    }
  }
  return {
    key: option.key ?? `${option.value}-${index}`,
    label: option.label ?? String(option.value ?? ''),
    value: option.value,
    count: option.count,
    disabled: !!option.disabled
  }
}))

const selectedOption = computed(() => normalizedOptions.value.find(option => isSameValue(option.value, props.modelValue)))
const selectedLabel = computed(() => selectedOption.value?.label || props.placeholder)

function isSameValue(a, b) {
  if (a === b) return true
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true
  return String(a) === String(b)
}

function isSelected(value) {
  return isSameValue(value, props.modelValue)
}

function updatePosition() {
  if (!import.meta.client || !triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const gap = 8
  const width = Math.max(rect.width, props.minWidth || 0)
  menuStyle.value = {
    left: `${Math.round(rect.left)}px`,
    top: `${Math.round(rect.bottom + gap)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.max(180, Math.min(360, window.innerHeight - rect.bottom - 24))}px`
  }
}

function openMenu() {
  if (props.disabled || open.value) return
  open.value = true
  nextTick(updatePosition)
}

function closeMenu() {
  open.value = false
}

function toggle() {
  if (props.disabled) return
  open.value ? closeMenu() : openMenu()
}

function selectOption(option) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  closeMenu()
}

function onDocumentPointerDown(event) {
  if (!open.value) return
  const target = event.target
  if (rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  closeMenu()
}

function onKeydown(event) {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})

watch(open, (value) => {
  if (value) nextTick(updatePosition)
})
</script>

<style scoped>
.taotu-select {
  position: relative;
  width: 100%;
  min-width: 0;
}

.taotu-select-trigger {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 4px 7px 14px;
  border: 1px solid rgba(214, 220, 238, 0.74);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 8px 22px rgba(116, 93, 140, 0.06);
  color: var(--taotu-text);
  cursor: pointer;
  transition: border-color var(--taotu-transition), box-shadow var(--taotu-transition), background var(--taotu-transition);
}

.taotu-select-trigger:hover,
.taotu-select.open .taotu-select-trigger {
  border-color: rgba(174, 151, 255, 0.55);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 28px rgba(116, 93, 140, 0.1);
}

.taotu-select-trigger:focus-visible {
  outline: 2px solid rgba(248, 95, 154, 0.26);
  outline-offset: 2px;
}

.taotu-select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.taotu-select-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
  color: var(--taotu-text);
  text-align: left;
}

.taotu-select-value.placeholder {
  color: var(--taotu-text-muted);
}

.taotu-select-caret {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  margin-right: 3px;
  object-fit: contain;
  transition: transform var(--taotu-transition);
}

.taotu-select-caret.open {
  transform: rotate(180deg);
}

.taotu-select-menu {
  position: fixed;
  z-index: 3000;
  padding: 10px;
  overflow-y: auto;
  border: 1px solid rgba(242, 222, 236, 0.82);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(22px);
  box-shadow: 0 18px 44px rgba(93, 75, 125, 0.14);
}

.taotu-select-menu::-webkit-scrollbar {
  width: 4px;
}

.taotu-select-menu::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(188, 169, 210, 0.42);
}

.taotu-select-option {
  width: 100%;
  min-height: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--taotu-text);
  cursor: pointer;
  transition: background var(--taotu-transition), color var(--taotu-transition), transform var(--taotu-transition);
}

.taotu-select-option:hover {
  background: rgba(255, 242, 248, 0.82);
}

.taotu-select-option.selected {
  background: rgba(255, 215, 233, 0.86);
  color: #f05b96;
}

.taotu-select-option.disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
  text-align: left;
}

.option-count {
  font-size: 14px;
  line-height: 20px;
  color: var(--taotu-text-muted);
}

.option-check {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(248, 95, 154, 0.78);
}

.option-check img {
  width: 12px;
  height: 12px;
  object-fit: contain;
}
</style>
