/**
 * 认证组合式函数
 */
export function useAuth() {
  const user = useState('auth_user', () => null)
  const isLoggedIn = computed(() => !!user.value)
  const { clearAuthSession } = useUiCache()

  const login = async (username, password) => {
    const api = useApi()
    const data = await api.post('/api/admin/auth/login', { username, password })
    if (data.token) {
      localStorage.setItem('jwt_token', data.token)
      user.value = data.user
    }
    return data
  }

  const logout = () => {
    clearAuthSession()
    user.value = null
    navigateTo('/admin/login')
  }

  const checkAuth = () => {
    if (import.meta.client) {
      const token = localStorage.getItem('jwt_token')
      if (!token) return false
      // 简单检查 token 是否过期
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.exp * 1000 > Date.now()
      } catch {
        return false
      }
    }
    return false
  }

  return { user, isLoggedIn, login, logout, checkAuth }
}
