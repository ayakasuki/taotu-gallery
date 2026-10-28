<template>
  <button class="profile-trigger" type="button" @click.stop="openProfile"><slot>{{ nickname || '用户' }}</slot></button>
  <Teleport to="body">
      <div v-if="open" class="profile-backdrop" @click.self="open = false">
        <section class="profile-card" role="dialog" aria-modal="true" aria-label="用户资料">
          <button class="profile-close" type="button" aria-label="关闭" @click="open = false"><TaotuIcon name="close" /></button>
          <div v-if="loading" class="profile-loading"><TaotuIcon name="loading" />加载中</div>
          <template v-else-if="profile">
            <header class="profile-head">
              <img v-if="profile.user.avatar" :src="assetUrl(profile.user.avatar)" alt="" />
              <span v-else class="profile-avatar-fallback">{{ (profile.user.nickname || 'U').slice(0, 1).toUpperCase() }}</span>
              <div><strong>{{ profile.user.nickname }}</strong><span>@{{ profile.user.username }}</span></div>
            </header>
            <div v-if="profile.favorites.length" class="profile-favorites">
              <h3>最近收藏</h3>
              <NuxtLink v-for="image in profile.favorites" :key="image.id" :to="{ path: '/image', query: { id: image.id } }" @click="open = false">
                <img :src="assetUrl(image.thumb_url || image.medium_url || image.url)" :alt="image.filename" />
              </NuxtLink>
            </div>
          </template>
        </section>
      </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({ userId: { type: [Number, String], required: true }, nickname: { type: String, default: '' } })
const api = useApi()
const open = ref(false)
const loading = ref(false)
const profile = ref(null)

function assetUrl(value) {
  if (!value) return ''
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  return `${useRuntimeConfig().public.apiBase || ''}${value.startsWith('/') ? value : `/${value}`}`
}

async function openProfile() {
  open.value = true
  if (profile.value) return
  loading.value = true
  try { profile.value = await api.get(`/api/internal/images/uploader/${props.userId}`) }
  catch { profile.value = null }
  finally { loading.value = false }
}
</script>

<style scoped>
.profile-trigger { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: inherit; cursor: pointer; }
.profile-trigger:hover { color: var(--taotu-pink, #f05d98); }
.profile-backdrop { position: fixed; inset: 0; z-index: 4000; display: grid; place-items: center; padding: 18px; background: rgba(28, 35, 50, .28); backdrop-filter: blur(4px); }
.profile-card { position: relative; width: min(420px, 100%); padding: 20px; border: 2px solid rgba(255,255,255,.92); border-radius: 8px; background: rgba(255,255,255,.96); box-shadow: 0 20px 64px rgba(43,53,76,.2); }
.profile-close { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 8px; background: #ff78a7; color: #fff; cursor: pointer; }
.profile-head { display: grid; grid-template-columns: 58px minmax(0,1fr); align-items: center; gap: 14px; padding-right: 28px; }
.profile-head img,.profile-avatar-fallback { width: 58px; height: 58px; border-radius: 50%; object-fit: cover; }
.profile-avatar-fallback { display: grid; place-items: center; background: #ffe5ef; color: #ef5b96; font-size: 21px; font-weight: 900; }
.profile-head div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.profile-head strong { overflow: hidden; color: #39445b; font-size: 18px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.profile-head span { color: #929bad; font-size: 12px; font-weight: 800; }
.profile-favorites { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 7px; margin-top: 16px; }
.profile-favorites h3 { grid-column: 1 / -1; margin: 0 0 2px; color: #929bad; font-size: 12px; font-weight: 800; }
.profile-favorites a { aspect-ratio: 1; overflow: hidden; border-radius: 6px; background: #f3f5f9; }
.profile-favorites img { width: 100%; height: 100%; object-fit: cover; }
.profile-loading { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 80px; color: #8993a7; font-size: 13px; font-weight: 800; }
</style>
