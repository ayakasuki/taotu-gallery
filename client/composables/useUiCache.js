const SITE_CONFIG_CACHE_KEY = 'taotu_site_public_config'
const CURRENT_USER_CACHE_KEY = 'taotu_current_user'
const AUTH_TOKEN_KEY = 'jwt_token'
const AUTH_COOKIE_NAME = 'taotu_token'

function isAuthFailure(err) {
  const status = Number(err?.status || err?.statusCode || err?.response?.status || err?.data?.statusCode || 0)
  return status === 401 || status === 403
}

function readAuthPayload() {
  if (!import.meta.client) return null
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function useUiCache() {
  const config = useRuntimeConfig()

  const writeAuthCookie = (token) => {
    if (!import.meta.client || !token) return
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=604800; Path=/; SameSite=Lax${secure}`
    } catch {}
  }

  const clearAuthCookie = () => {
    if (!import.meta.client) return
    try {
      document.cookie = `${AUTH_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`
      document.cookie = `${AUTH_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax; Secure`
    } catch {}
  }

  const writeAuthToken = (token) => {
    if (!import.meta.client || !token) return
    try { localStorage.setItem(AUTH_TOKEN_KEY, token) } catch {}
    writeAuthCookie(token)
  }

  const syncAuthCookie = () => {
    if (!import.meta.client) return ''
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY) || ''
      if (!token) {
        clearAuthCookie()
        return ''
      }
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && payload.exp * 1000 <= Date.now()) {
        clearAuthCookie()
        return ''
      }
      writeAuthCookie(token)
      return token
    } catch {
      clearAuthCookie()
      return ''
    }
  }

  const normalizeAssetUrl = (url) => {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    return `${config.public.apiBase || ''}${url}`
  }

  const readJsonCache = (key) => {
    if (!import.meta.client) return null
    try {
      return JSON.parse(localStorage.getItem(key) || 'null')
    } catch {
      return null
    }
  }

  const writeJsonCache = (key, value, eventName) => {
    if (!import.meta.client) return
    try {
      localStorage.setItem(key, JSON.stringify(value || null))
      window.dispatchEvent(new CustomEvent(eventName, { detail: value || null }))
    } catch {}
  }

  const removeJsonCache = (key, eventName) => {
    if (!import.meta.client) return
    try {
      localStorage.removeItem(key)
      window.dispatchEvent(new CustomEvent(eventName, { detail: null }))
    } catch {}
  }

  return {
    readSiteConfigCache: () => readJsonCache(SITE_CONFIG_CACHE_KEY),
    writeSiteConfigCache: (value) => writeJsonCache(SITE_CONFIG_CACHE_KEY, value, 'taotu:site-config-updated'),
    readCurrentUserCache: () => readJsonCache(CURRENT_USER_CACHE_KEY),
    writeCurrentUserCache: (value) => writeJsonCache(CURRENT_USER_CACHE_KEY, value, 'taotu:current-user-updated'),
    clearCurrentUserCache: () => removeJsonCache(CURRENT_USER_CACHE_KEY, 'taotu:current-user-updated'),
    readAuthPayload,
    writeAuthToken,
    syncAuthCookie,
    clearAuthSession: () => {
      if (!import.meta.client) return
      try { localStorage.removeItem(AUTH_TOKEN_KEY) } catch {}
      clearAuthCookie()
      removeJsonCache(CURRENT_USER_CACHE_KEY, 'taotu:current-user-updated')
      try { window.dispatchEvent(new CustomEvent('taotu:auth-invalid')) } catch {}
    },
    isAuthFailure,
    normalizeAssetUrl
  }
}
