<template>
  <div v-if="image" class="image-preview-overlay" @click.self="close">
    <article
      class="image-preview-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      :style="{ '--preview-dialog-width': dialogWidth }"
    >
      <header class="image-preview-header">
        <strong>图片预览</strong>
        <button type="button" class="image-preview-close" aria-label="关闭预览" @click="close">
          <TaotuIcon name="close" :stateful="false" />
        </button>
      </header>
      <div class="image-preview-stage">
        <img ref="previewImageRef" :src="previewUrl" :alt="image.filename || '图片预览'" @load="updateDialogWidth" />
      </div>
      <NuxtLink
        class="image-detail-link"
        :to="detailLocation"
        target="_blank"
        rel="noopener noreferrer"
        @click="close"
      >
        <TaotuIcon name="open-detail" :stateful="false" />
        <span>图片详情</span>
      </NuxtLink>
    </article>
  </div>
</template>

<script setup>
const props = defineProps({
  image: { type: Object, default: null }
})

const emit = defineEmits(['close'])
const config = useRuntimeConfig()
const previewImageRef = ref(null)
const dialogWidth = ref('52vw')

const previewUrl = computed(() => {
  const url = props.image?.medium_url || props.image?.url || props.image?.thumb_url || ''
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `${config.public.apiBase || ''}${url}`
})

const detailLocation = computed(() => ({
  path: '/image',
  query: { id: String(props.image?.id || '') }
}))
const close = () => emit('close')

function updateDialogWidth() {
  if (!import.meta.client) return
  const image = previewImageRef.value
  const naturalWidth = Number(image?.naturalWidth || props.image?.width || 0)
  const naturalHeight = Number(image?.naturalHeight || props.image?.height || 0)
  if (!naturalWidth || !naturalHeight) {
    dialogWidth.value = '52vw'
    return
  }
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const maxImageWidth = viewportWidth * 0.5
  const maxImageHeight = viewportHeight * 0.5
  const imageWidth = Math.min(naturalWidth, maxImageWidth, maxImageHeight * naturalWidth / naturalHeight)
  const dialogWidthPx = Math.min(viewportWidth - 32, imageWidth + viewportWidth * 0.02)
  dialogWidth.value = `${Math.max(160, Math.round(dialogWidthPx))}px`
}

function onViewportResize() {
  updateDialogWidth()
}

watch(() => props.image, async (image) => {
  if (!image) return
  dialogWidth.value = '52vw'
  await nextTick()
  if (previewImageRef.value?.complete) updateDialogWidth()
})

onMounted(() => window.addEventListener('resize', onViewportResize))
onBeforeUnmount(() => window.removeEventListener('resize', onViewportResize))
</script>

<style scoped>
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 2600;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(38, 44, 62, 0.32);
  backdrop-filter: blur(6px);
}

.image-preview-dialog {
  width: min(var(--preview-dialog-width, 52vw), calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 16px 16px;
  overflow: hidden;
  border: 1px solid rgba(234, 224, 236, 0.94);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 80px rgba(58, 64, 88, 0.24);
}

.image-preview-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  color: #30384e;
  font-size: 14px;
  font-weight: 900;
}

.image-preview-close {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #8b93a8;
  cursor: pointer;
}

.image-preview-close:hover {
  background: #fff0f6;
  color: #f05f98;
}

.image-preview-close .taotu-svg-icon {
  width: 17px;
  height: 17px;
}

.image-preview-stage {
  width: 100%;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.image-preview-stage img {
  display: block;
  width: auto;
  height: auto;
  max-width: 50vw;
  max-height: 50vh;
  object-fit: contain;
  border-radius: 8px;
  background: #f4f6fa;
}

.image-detail-link {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 14px;
  padding: 0 16px;
  border: 1px solid rgba(248, 95, 154, 0.2);
  border-radius: 8px;
  background: #fff0f6;
  color: #f05f98;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.image-detail-link:hover {
  background: #f05f98;
  color: #fff;
  transform: translateY(-1px);
}

.image-detail-link .taotu-svg-icon {
  width: 16px;
  height: 16px;
}

@media (max-width: 700px) {
  .image-preview-overlay {
    padding: 16px;
  }

  .image-preview-dialog {
    width: min(var(--preview-dialog-width, 92vw), calc(100vw - 32px));
  }

  .image-preview-stage img {
    max-width: calc(100vw - 64px);
    max-height: 50vh;
  }
}
</style>
