/**
 * API 请求组合式函数
 * 统一部署时前后端同端口，使用相对路径
 */
export function useApi() {
  const config = useRuntimeConfig()

  const getApiBase = () => config.public.apiBase || ''

  const getToken = () => {
    if (import.meta.client) {
      return localStorage.getItem('api_token') || ''
    }
    return ''
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

    return $fetch(`${apiBase}${url}`, {
      ...options,
      headers
    })
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
