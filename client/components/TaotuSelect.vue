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
      <TaotuIcon name="chevron-down" class="taotu-select-caret" :class="{ open }" />
    </button>

    <Teleport to="body">
      <Transition name="taotu-select-pop">
      <div
        v-if="open"
        ref="menuRef"
        class="taotu-select-menu"
        :class="[
          `placement-${menuPlacement}`,
          { scrollable: normalizedOptions.length > maxVisibleOptions, 'has-description': hasDescriptions }
        ]"
        :style="menuStyle"
      >
        <button
          v-for="option in normalizedOptions"
          :key="option.key"
          type="button"
          class="taotu-select-option"
          :class="{ selected: isSelected(option.value), disabled: option.disabled }"
          :disabled="option.disabled"
          :title="option.title"
          @click="selectOption(option)"
        >
          <span class="option-copy">
            <span class="option-label">{{ option.label }}</span>
            <span v-if="option.description" class="option-description">{{ option.description }}</span>
          </span>
          <span v-if="option.count !== undefined && option.count !== null" class="option-count">{{ option.count }}</span>
          <span v-if="isSelected(option.value)" class="option-check">
            <TaotuIcon name="success" />
          </span>
        </button>
      </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: [String, Number, Boolean, null], default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  minWidth: { type: Number, default: 0 },
  maxVisibleOptions: { type: Number, default: 4 }
})

const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const triggerRef = ref(null)
const menuRef = ref(null)
const open = ref(false)
const menuStyle = ref({})
const menuPlacement = ref('bottom')

const normalizedOptions = computed(() => props.options.map((option, index) => {
  if (typeof option === 'string' || typeof option === 'number') {
    return {
      key: `${option}-${index}`,
      label: String(option),
      value: option,
      title: String(option),
      disabled: false
    }
  }
  const label = option.label ?? String(option.value ?? '')
  const description = option.description || option.subtitle || ''
  return {
    key: option.key ?? `${option.value}-${index}`,
    label,
    value: option.value,
    description,
    title: [label, description].filter(Boolean).join(String.fromCharCode(10)),
    count: option.count,
    disabled: !!option.disabled
  }
}))

const selectedOption = computed(() => normalizedOptions.value.find(option => isSameValue(option.value, props.modelValue)))
const selectedLabel = computed(() => selectedOption.value?.label || props.placeholder)
const hasDescriptions = computed(() => normalizedOptions.value.some(option => option.description))

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
  const rawWidth = Math.max(rect.width, props.minWidth || 0)
  const width = Math.min(rawWidth, window.innerWidth - 32)
  const visibleCount = Math.max(1, props.maxVisibleOptions || 4)
  const shownCount = Math.min(normalizedOptions.value.length, visibleCount)
  const optionHeight = hasDescriptions.value ? 48 : 34
  const optionGap = 5
  const menuPadding = 14
  const preferredHeight = Math.max(52, shownCount * optionHeight + Math.max(0, shownCount - 1) * optionGap + menuPadding)
  const availableBelow = window.innerHeight - rect.bottom - 24
  const availableAbove = rect.top - 24
  const shouldOpenAbove = preferredHeight > availableBelow && availableAbove > availableBelow
  const availableSpace = Math.max(80, shouldOpenAbove ? availableAbove : availableBelow)
  const maxHeight = Math.min(preferredHeight, availableSpace)
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16)
  const top = shouldOpenAbove
    ? Math.max(16, rect.top - gap - maxHeight)
    : Math.round(rect.bottom + gap)
  menuPlacement.value = shouldOpenAbove ? 'top' : 'bottom'
  menuStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.round(maxHeight)}px`,
    '--taotu-select-menu-height': `${Math.round(maxHeight)}px`
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

.taotu-select.soft-select,
.taotu-select.soft-input,
.taotu-select.page-size-select,
.taotu-select.range-select,
.taotu-select.user-filter,
.taotu-select.album-filter {
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  outline: none;
}

.taotu-select.page-size-select {
  width: 118px;
  flex: 0 0 auto;
}

.taotu-select.range-select {
  width: 132px;
  flex: 0 0 auto;
}

.taotu-select.user-filter {
  width: 132px;
  flex: 0 0 auto;
}

.taotu-select.album-filter {
  width: 150px;
  flex: 0 0 auto;
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
  transition: transform var(--taotu-transition);
}

.taotu-select-caret.open {
  transform: rotate(180deg);
}

.taotu-select-menu {
  position: fixed;
  z-index: 3000;
  padding: 7px;
  overflow-y: hidden;
  overscroll-behavior: contain;
  border: 1px solid rgba(202, 204, 210, 0.88);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(22px);
  box-shadow: 0 18px 44px rgba(93, 75, 125, 0.14);
  transform-origin: top center;
  scrollbar-width: thin;
  scrollbar-color: rgba(248, 95, 154, 0.5) rgba(255, 240, 246, 0.7);
}

.taotu-select-menu.scrollable {
  overflow-y: auto;
  padding-right: 9px;
}

.taotu-select-menu.placement-top {
  transform-origin: bottom center;
}

.taotu-select-menu::-webkit-scrollbar {
  width: 4px;
}

.taotu-select-menu::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(248, 95, 154, 0.5);
}

.taotu-select-menu::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(255, 240, 246, 0.72);
}

.taotu-select-option {
  width: 100%;
  min-height: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  padding: 5px 7px 5px 9px;
  border: 2px solid rgba(226, 226, 226, 0.9);
  border-radius: 8px;
  background: rgba(246, 246, 246, 0.76);
  color: rgba(122, 127, 140, 0.56);
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: border-color var(--taotu-transition), background var(--taotu-transition), color var(--taotu-transition), transform var(--taotu-transition), box-shadow var(--taotu-transition);
}

.taotu-select-menu.has-description .taotu-select-option {
  min-height: 48px;
  align-items: center;
  padding: 6px 9px;
}

.taotu-select-option:last-child {
  margin-bottom: 0;
}

.taotu-select-option:hover {
  border-color: rgba(248, 95, 154, 0.82);
  background: rgba(255, 247, 251, 0.94);
  color: var(--taotu-pink);
  transform: translateY(-0.5px);
  box-shadow: 0 6px 14px rgba(248, 95, 154, 0.08);
}

.taotu-select-option.selected {
  border-color: rgba(248, 95, 154, 0.95);
  background: rgba(255, 246, 250, 0.98);
  color: #f05b96;
  box-shadow: 0 6px 14px rgba(248, 95, 154, 0.08);
}

.taotu-select-option.disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.option-copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.option-label {
  min-width: 0;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 15px;
  font-weight: 900;
  text-align: left;
}

.option-description {
  min-width: 0;
  display: block;
  overflow: hidden;
  color: color-mix(in srgb, currentColor 48%, #c8c8c8);
  font-size: 10px;
  font-weight: 850;
  line-height: 13px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-count {
  font-size: 11px;
  line-height: 15px;
  color: color-mix(in srgb, currentColor 66%, #c8c8c8);
  font-weight: 900;
}

.option-check {
  width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #f05b96;
}

.option-check .taotu-svg-icon {
  width: 15px;
  height: 15px;
}

.taotu-select-pop-enter-active,
.taotu-select-pop-leave-active {
  overflow: hidden;
  transition: opacity 170ms ease, transform 190ms cubic-bezier(0.18, 0.92, 0.22, 1), clip-path 190ms ease;
}

.taotu-select-pop-enter-from,
.taotu-select-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scaleY(0.86);
  clip-path: inset(0 0 100% 0 round 8px);
}

.taotu-select-menu.placement-top.taotu-select-pop-enter-from,
.taotu-select-menu.placement-top.taotu-select-pop-leave-to {
  transform: translateY(8px) scaleY(0.86);
  clip-path: inset(100% 0 0 0 round 8px);
}

.taotu-select-pop-enter-to,
.taotu-select-pop-leave-from {
  opacity: 1;
  transform: translateY(0) scaleY(1);
  clip-path: inset(0 0 0 0 round 8px);
}
</style>
