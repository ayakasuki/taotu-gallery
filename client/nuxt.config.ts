export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  css: [
    '~/assets/css/fluent.css',
    '~/assets/css/main.css'
  ],

  app: {
    head: {
      title: '桃图智库', // 默认标题，会被布局动态覆盖
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '探索美好的图像世界。' },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { property: 'og:site_name', content: '桃图智库' },
        { property: 'og:title', content: '桃图智库' },
        { property: 'og:description', content: '探索美好的图像世界。' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: '桃图智库' },
        { name: 'twitter:description', content: '探索美好的图像世界。' }
      ]
    }
  },

  runtimeConfig: {
    public: {
      // 统一部署时使用空字符串（相对路径），前后端同端口
      apiBase: process.env.NUXT_PUBLIC_API_BASE || ''
    }
  },

  // 静态生成模式
  nitro: {
    preset: 'static'
  }
})
