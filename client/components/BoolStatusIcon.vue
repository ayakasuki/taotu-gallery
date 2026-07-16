<template>
  <span class="bool-status-icon" :class="value ? 'ok' : 'no'" :title="value ? trueLabel : falseLabel">
    <TaotuIcon :name="value ? 'success' : 'failure'" filled :stateful="false" />
  </span>
</template>

<script setup>
defineProps({
  value: { type: Boolean, default: false },
  trueLabel: { type: String, default: '是' },
  falseLabel: { type: String, default: '否' }
})
</script>

<style scoped>
.bool-status-icon {
  --bool-icon-size: 1.35em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--bool-icon-size);
  height: var(--bool-icon-size);
  line-height: 1;
  vertical-align: middle;
}

.bool-status-icon .taotu-svg-icon {
  width: 100%;
  height: 100%;
}

.bool-status-icon.ok {
  color: #34b88c;
}

.bool-status-icon.no {
  color: #f06f93;
}
</style>
