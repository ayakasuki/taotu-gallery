<template>
  <Teleport to="body">
    <Transition name="manual-image-hover">
      <div
        v-if="visible && previewImage"
        class="manual-image-hover-preview"
        :class="`placement-${placement}`"
        :style="previewStyle"
      >
        <img :src="previewSrc" :alt="previewImage.filename || '图片预览'" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const config = useRuntimeConfig()
const visible = ref(false)
const previewImage = ref(null)
const placement = ref('top')
const position = reactive({ top: 0, left: 0, height: 220 })
let showTimer = null
let hideTimer = null

const PREVIEW_WIDTH = 320
const GAP = 12
const EDGE = 12

const normalizeAssetUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}

const previewSrc = computed(() => {
  const image = previewImage.value || {}
  return normalizeAssetUrl(image.medium_url || image.thumb_url || image.url)
})

const previewHeight = (image) => {
  const width = Number(image?.width || 0)
  const height = Number(image?.height || 0)
  const ratio = width > 0 && height > 0 ? height / width : 0.68
  const rawHeight = Math.round(PREVIEW_WIDTH * ratio)
  const maxHeight = Math.max(160, (import.meta.client ? window.innerHeight : 900) - EDGE * 2)
  return Math.max(150, Math.min(rawHeight, maxHeight))
}

const updatePosition = (targetEl, image) => {
  if (!import.meta.client || !targetEl?.getBoundingClientRect) return
  const rect = targetEl.getBoundingClientRect()
  const height = previewHeight(image)
  const viewportWidth = window.innerWidth || 1280
  const viewportHeight = window.innerHeight || 720
  let top = rect.top - height - GAP
  let nextPlacement = 'top'

  if (top < EDGE) {
    top = rect.bottom + GAP
    nextPlacement = 'bottom'
  }
  if (top + height > viewportHeight - EDGE) {
    top = Math.max(EDGE, viewportHeight - height - EDGE)
  }

  let left = rect.left + rect.width / 2 - PREVIEW_WIDTH / 2
  left = Math.max(EDGE, Math.min(left, viewportWidth - PREVIEW_WIDTH - EDGE))

  position.top = Math.round(top)
  position.left = Math.round(left)
  position.height = height
  placement.value = nextPlacement
}

const previewStyle = computed(() => ({
  width: `${PREVIEW_WIDTH}px`,
  height: `${position.height}px`,
  transform: `translate3d(${position.left}px, ${position.top}px, 0)`
}))

const show = (image, targetEl) => {
  if (!image || !targetEl) return
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  showTimer = setTimeout(() => {
    previewImage.value = image
    updatePosition(targetEl, image)
    visible.value = true
  }, 140)
}

const hide = () => {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    visible.value = false
  }, 80)
}

onBeforeUnmount(() => {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
})

defineExpose({ show, hide })
</script>

<style scoped>
.manual-image-hover-preview {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 8000;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.84);
  border-radius: 14px;
  background: rgba(248, 242, 250, 0.92);
  box-shadow: 0 20px 56px rgba(58, 44, 78, 0.28), 0 0 0 1px rgba(255, 122, 167, 0.16);
  pointer-events: none;
  backdrop-filter: blur(16px) saturate(1.08);
  will-change: transform, opacity;
}

.manual-image-hover-preview img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.38);
}

.manual-image-hover-enter-active,
.manual-image-hover-leave-active {
  transition: opacity 0.14s ease, filter 0.14s ease;
}

.manual-image-hover-enter-from,
.manual-image-hover-leave-to {
  opacity: 0;
  filter: blur(3px);
}

.manual-image-hover-enter-to,
.manual-image-hover-leave-from {
  opacity: 1;
  filter: blur(0);
}
</style>
