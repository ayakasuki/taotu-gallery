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
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
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
