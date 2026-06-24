<template>
  <div class="gallery-grid" :class="[`mode-${mode}`]">
    <!-- 普通网格 -->
    <div v-if="mode === 'grid'" class="grid grid-cols-4">
      <ImageCard
        v-for="image in images"
        :key="image.id"
        :image="image"
        @click="$emit('select', image)"
      />
    </div>

    <!-- 瀑布流 -->
    <div v-else-if="mode === 'waterfall'" class="waterfall">
      <div v-for="image in images" :key="image.id" class="waterfall-item">
        <ImageCard :image="image" @click="$emit('select', image)" />
      </div>
    </div>

    <!-- 静态展示 -->
    <div v-else-if="mode === 'static'" class="static-grid">
      <div v-for="image in images" :key="image.id" class="static-item">
        <img :src="getImageUrl(image)" :alt="image.filename" />
      </div>
    </div>

    <!-- 轮播随机 -->
    <div v-else-if="mode === 'carousel'" class="carousel">
      <div class="carousel-track" :style="{ transform: `translateX(-${carouselIndex * 100}%)` }">
        <div v-for="image in images" :key="image.id" class="carousel-slide">
          <img :src="getImageUrl(image)" :alt="image.filename" />
        </div>
      </div>
      <button class="carousel-btn prev" @click="prevSlide">&lt;</button>
      <button class="carousel-btn next" @click="nextSlide">&gt;</button>
    </div>

    <!-- 空状态 -->
    <div v-if="images.length === 0 && !loading" class="empty-state">
      <p>暂无图片</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import ImageCard from './ImageCard.vue'

const props = defineProps({
  images: { type: Array, default: () => [] },
  mode: { type: String, default: 'grid' },
  loading: { type: Boolean, default: false }
})

defineEmits(['select'])

const config = useRuntimeConfig()
const carouselIndex = ref(0)

const getImageUrl = (image) => {
  const url = image.thumb_url || image.url
  return url ? `${config.public.apiBase}${url}` : ''
}

const prevSlide = () => {
  carouselIndex.value = Math.max(0, carouselIndex.value - 1)
}

const nextSlide = () => {
  carouselIndex.value = Math.min(props.images.length - 1, carouselIndex.value + 1)
}

// 轮播自动播放
let autoplayTimer = null
onMounted(() => {
  if (props.mode === 'carousel') {
    autoplayTimer = setInterval(() => {
      carouselIndex.value = (carouselIndex.value + 1) % props.images.length
    }, 3000)
  }
})

onUnmounted(() => {
  if (autoplayTimer) clearInterval(autoplayTimer)
})
</script>

<style scoped>
.static-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 2px;
}

.static-item img {
  width: 100%;
  display: block;
}

.carousel {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
}

.carousel-track {
  display: flex;
  transition: transform 0.5s ease;
}

.carousel-slide {
  min-width: 100%;
}

.carousel-slide img {
  width: 100%;
  max-height: 500px;
  object-fit: contain;
  background: #000;
}

.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.8);
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  z-index: 10;
}

.carousel-btn.prev { left: 16px; }
.carousel-btn.next { right: 16px; }

.empty-state, .loading-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--fluent-text-secondary);
}
</style>
