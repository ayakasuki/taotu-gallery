/**
 * 图库组合式函数
 */
export function useGallery() {
  const images = useState('gallery_images', () => [])
  const total = useState('gallery_total', () => 0)
  const page = useState('gallery_page', () => 1)
  const loading = useState('gallery_loading', () => false)
  const displayMode = useState('gallery_mode', () => 'grid') // grid, waterfall
  const sort = useState('gallery_sort', () => 'created_at')
  const order = useState('gallery_order', () => 'desc')

  const fetchImages = async (params = {}) => {
    loading.value = true
    try {
      const api = useApi()
      const data = await api.get('/api/internal/images', {
        page: params.page || page.value,
        limit: params.limit || 20,
        sort: params.sort || sort.value,
        order: params.order || order.value,
        tags: params.tags || undefined,
        album: params.album || undefined,
        mine: params.mine || undefined,
        public: params.public || undefined,
        userId: params.userId || undefined
      })
      images.value = data.images || []
      total.value = data.total || 0
      page.value = data.page || 1
    } catch (err) {
      console.error('获取图片失败:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchRandomImages = async (count = 1, params = {}) => {
    loading.value = true
    try {
      const api = useApi()
      const data = await api.get('/api/internal/images/random', {
        count,
        tags: params.tags || undefined,
        album: params.album || undefined
      })
      images.value = data.images || []
    } catch (err) {
      console.error('获取随机图片失败:', err)
    } finally {
      loading.value = false
    }
  }

  const setDisplayMode = (mode) => {
    displayMode.value = mode === 'waterfall' ? 'waterfall' : 'grid'
  }

  const setSort = (newSort, newOrder = 'desc') => {
    sort.value = newSort
    order.value = newOrder
  }

  return {
    images, total, page, loading, displayMode, sort, order,
    fetchImages, fetchRandomImages, setDisplayMode, setSort
  }
}
