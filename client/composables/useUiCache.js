const SITE_CONFIG_CACHE_KEY = 'taotu_site_public_config'
const CURRENT_USER_CACHE_KEY = 'taotu_current_user'

function isAuthFailure(err) {
  const status = Number(err?.status || err?.statusCode || err?.response?.status || err?.data?.statusCode || 0)
  return status === 401 || status === 403
}

export function useUiCache() {
  const config = useRuntimeConfig()

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
    clearAuthSession: () => {
      if (!import.meta.client) return
      try { localStorage.removeItem('jwt_token') } catch {}
      removeJsonCache(CURRENT_USER_CACHE_KEY, 'taotu:current-user-updated')
      try { window.dispatchEvent(new CustomEvent('taotu:auth-invalid')) } catch {}
    },
    isAuthFailure,
    normalizeAssetUrl
  }
}
