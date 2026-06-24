/**
 * 后端连接检测插件
 * 每次页面加载时检测后端是否可达，不可达时跳转到设置页
 */
export default defineNuxtPlugin(async () => {
  if (!import.meta.client) return

  const api = useApi()

  // 跳过设置页本身的检测
  const route = useRoute()
  if (route.path === '/settings') return

  try {
    const result = await api.checkConnection()
    if (!result.connected) {
      // 保存检测结果供设置页使用
      localStorage.setItem('connection_error', JSON.stringify({
        url: result.url,
        error: result.error,
        time: Date.now()
      }))
    } else {
      localStorage.removeItem('connection_error')
    }
  } catch {
    // 静默失败，不影响页面加载
  }
})
