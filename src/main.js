import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import GateView from './views/GateView.vue'
import HomeView from './views/HomeView.vue'
import ReadingView from './views/ReadingView.vue'
import { auth, checkGate } from './api.js'
import './styles.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/gate', name: 'gate', component: GateView },
    { path: '/reading', name: 'reading', component: ReadingView }
  ]
})

router.beforeEach(async (to) => {
  if (!auth.checked) {
    await checkGate()
    auth.checked = true
  }
  if (!auth.unlocked && to.name !== 'gate') return { name: 'gate' }
  if (auth.unlocked && to.name === 'gate') return { name: 'home' }
  return true
})

createApp(App).use(router).mount('#app')
