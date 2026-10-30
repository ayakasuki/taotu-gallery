const TOKEN_KEY = 'taotu_guest_like_token'
const LIKES_KEY = 'taotu_guest_likes'

export function useGuestLikes() {
  const getGuestLikeToken = () => {
    if (!import.meta.client) return ''
    try {
      let token = localStorage.getItem(TOKEN_KEY)
      if (!token) {
        token = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().replaceAll('-', '')
          : Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('')
        localStorage.setItem(TOKEN_KEY, token)
      }
      return token
    } catch {
      return window.__taotuGuestLikeToken ||= Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('')
    }
  }

  const isGuestLiked = (imageId) => {
    if (!import.meta.client) return false
    try {
      return !!JSON.parse(localStorage.getItem(LIKES_KEY) || '{}')[imageId]
    } catch {
      return false
    }
  }

  const saveGuestLike = (imageId, active) => {
    if (!import.meta.client) return
    try {
      const likedImages = JSON.parse(localStorage.getItem(LIKES_KEY) || '{}')
      if (active) likedImages[imageId] = true
      else delete likedImages[imageId]
      localStorage.setItem(LIKES_KEY, JSON.stringify(likedImages))
    } catch {}
  }

  return { getGuestLikeToken, isGuestLiked, saveGuestLike }
}
