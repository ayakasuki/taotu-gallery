/**
 * API 请求组合式函数
 * 统一部署时前后端同端口，使用相对路径
 */
export function useApi() {
  const config = useRuntimeConfig()
  const { clearAuthSession } = useUiCache()

  const getApiBase = () => config.public.apiBase || ''

  const getToken = () => {
    if (import.meta.client) {
      return localStorage.getItem('api_token') || ''
    }
    return ''
  }

  const shouldClearAuth = (url, err, hasJwt) => {
    if (!import.meta.client || !hasJwt) return false
    const status = Number(err?.status || err?.statusCode || err?.response?.status || err?.data?.statusCode || 0)
    if (status === 401) return true
    if (status !== 403) return false
    const message = String(err?.data?.error || err?.message || '')
    if (/未审核|禁用|disabled|pending/i.test(message)) return true
    return url === '/api/admin/auth/me'
  }

  const request = async (url, options = {}) => {
    const apiBase = getApiBase()
    const headers = { ...options.headers }

    const jwt = import.meta.client ? localStorage.getItem('jwt_token') : null
    const apiToken = getToken()

    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`
    } else if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`
    }

    try {
      return await $fetch(`${apiBase}${url}`, {
        ...options,
        headers
      })
    } catch (err) {
      if (shouldClearAuth(url, err, !!jwt)) clearAuthSession()
      throw err
    }
  }

  const checkConnection = async () => {
    try {
      const apiBase = getApiBase()
      await $fetch(`${apiBase}/api/tags`, { signal: AbortSignal.timeout(5000) })
      return { connected: true, url: apiBase || window.location.origin }
    } catch (err) {
      return { connected: false, url: getApiBase(), error: err.message }
    }
  }

  return {
    get: (url, params) => request(url, { method: 'GET', params }),
    post: (url, body) => request(url, { method: 'POST', body }),
    put: (url, body) => request(url, { method: 'PUT', body }),
    del: (url) => request(url, { method: 'DELETE' }),
    request,
    checkConnection
  }
}
