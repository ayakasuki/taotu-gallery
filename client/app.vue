<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <AdminToast />
</template>

<script setup>
const { showAdminToast } = useAdminToast()
const runtimeConfig = useRuntimeConfig()
let originalAlert = null

useHead({
  script: [
    {
      id: 'taotu-bg-preload',
      innerHTML: `
(function(){
  try {
    var raw = localStorage.getItem('taotu_site_public_config');
    if (!raw) return;
    var config = JSON.parse(raw);
    var bg = config && config.background ? config.background : {};
    var value = bg.value || '';
    if (!value || bg.type === 'default' || value === '/site_bg.png') return;
    if (!/^https?:\\/\\//i.test(value)) value = ${JSON.stringify(runtimeConfig.public.apiBase || '')} + value;
    value = String(value).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
    var top = bg.overlayTop || 'rgba(255, 255, 255, 0.08)';
    var bottom = bg.overlayBottom || 'rgba(255, 246, 250, 0.42)';
    var blur = Number(bg.blur || 0);
    var blurPx = Math.round(Math.min(100, Math.max(0, blur)) * 0.4 * 10) / 10;
    document.documentElement.style.setProperty('--site-bg-image', 'linear-gradient(to bottom, ' + top + ', ' + bottom + '), url("' + value + '")');
    document.documentElement.style.setProperty('--site-bg-filter', blurPx > 0 ? 'blur(' + blurPx + 'px)' : 'none');
  } catch (e) {}
})();`
    }
  ]
})

function inferToastType(message) {
  const text = String(message || '')
  if (/失败|错误|出错|异常|无权|禁止|不能为空|请先|不能|不存在|过期|未登录|无效/.test(text)) return 'error'
  if (/警告|注意|请确认/.test(text)) return 'warning'
  return 'success'
}

onMounted(() => {
  if (!import.meta.client) return
  originalAlert = window.alert
  window.alert = (message) => {
    showAdminToast(String(message || ''), inferToastType(message))
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client || !originalAlert) return
  window.alert = originalAlert
})
</script>
