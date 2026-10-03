<script setup lang="ts">
import { ref } from 'vue'
import HomeView from './views/HomeView.vue'
import SubscriptionsView from './views/SubscriptionsView.vue'
import SettingsView from './views/SettingsView.vue'
import { useAuth } from './data/auth'

const auth = useAuth()
const tabs = [
  { id: 'home', label: 'Início', icon: '◔' },
  { id: 'subs', label: 'Assinaturas', icon: '☰' },
  { id: 'settings', label: 'Ajustes', icon: '⚙' },
] as const
type Tab = (typeof tabs)[number]['id']

function initial(): Tab {
  try {
    return (localStorage.getItem('tab') as Tab) || 'home'
  } catch {
    return 'home'
  }
}
const tab = ref<Tab>(initial())
function go(t: Tab) {
  tab.value = t
  try {
    localStorage.setItem('tab', t)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <main>
    <HomeView v-if="tab === 'home'" />
    <SubscriptionsView v-else-if="tab === 'subs'" />
    <SettingsView v-else />
  </main>
  <nav class="tabs">
    <button v-for="t in tabs" :key="t.id" :class="{ on: tab === t.id }" @click="go(t.id)">
      <span>{{ t.icon }}</span>{{ t.label }}
    </button>
  </nav>
  <span hidden>{{ auth.ready }}</span>
</template>
