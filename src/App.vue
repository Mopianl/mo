<script setup>
import { onMounted, ref } from 'vue'
import { loadSettings } from './data.js'
import StarField from './components/StarField.vue'

const reduceMotion = ref(false)

onMounted(() => {
  reduceMotion.value = loadSettings().reduceMotion
  document.documentElement.classList.toggle('reduce-motion', reduceMotion.value)
})
</script>

<template>
  <div class="app-shell">
    <StarField />    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <footer class="app-footer">
      本产品为娱乐与自我觉察工具，非心理诊断或预测服务
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.app-footer {
  margin-top: auto;
  padding: 18px 24px calc(18px + env(safe-area-inset-bottom));
  text-align: center;
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
  opacity: 0.75;
}
</style>
