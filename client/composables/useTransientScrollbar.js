export function useTransientScrollbar() {
  const scrollbarVisible = ref(false)
  let hideTimer = null

  const showScrollbar = () => {
    scrollbarVisible.value = true
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { scrollbarVisible.value = false }, 2500)
  }

  onBeforeUnmount(() => {
    if (hideTimer) clearTimeout(hideTimer)
  })

  return { scrollbarVisible, showScrollbar }
}
