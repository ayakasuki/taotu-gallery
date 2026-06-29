let toastTimer = null

export function useAdminToast() {
  const toast = useState('taotu-admin-toast', () => ({
    visible: false,
    type: 'info',
    message: '',
    id: 0
  }))

  const hideAdminToast = () => {
    toast.value.visible = false
  }

  const showAdminToast = (message, type = 'info', duration = 2800) => {
    if (!message) return
    if (toastTimer) clearTimeout(toastTimer)
    toast.value = {
      visible: true,
      type,
      message: String(message),
      id: Date.now()
    }
    toastTimer = setTimeout(() => {
      hideAdminToast()
      toastTimer = null
    }, duration)
  }

  return {
    toast,
    showAdminToast,
    hideAdminToast
  }
}
