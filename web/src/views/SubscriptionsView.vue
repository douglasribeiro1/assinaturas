<script setup lang="ts">
import { computed, ref } from 'vue'
import SubscriptionForm from '../components/SubscriptionForm.vue'
import { useSubscriptions } from '../data/store'
import type { LocalSubscription } from '../data/types'
import type { Status } from '../engine/types'
import { formatMoney } from '../format'

const store = useSubscriptions()
const filter = ref<Status | 'all'>('active')
const editing = ref<LocalSubscription | null>(null)
const creating = ref(false)

const shown = computed(() =>
  store.items
    .filter((s) => filter.value === 'all' || s.status === filter.value)
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const cycleLabel: Record<string, string> = { weekly: 'sem', monthly: 'mês', quarterly: 'tri', yearly: 'ano' }
const every = (s: LocalSubscription) =>
  s.cycleInterval === 1 ? `/${cycleLabel[s.cycle]}` : ` a cada ${s.cycleInterval} ${cycleLabel[s.cycle]}`

type FormData = Parameters<typeof store.create>[0]
async function save(data: FormData) {
  if (editing.value) await store.update(editing.value.id, data)
  else await store.create(data)
  editing.value = null
  creating.value = false
}
async function remove() {
  if (editing.value && confirm(`Excluir "${editing.value.name}"?`)) {
    await store.remove(editing.value.id)
    editing.value = null
  }
}
</script>

<template>
  <h1>Assinaturas</h1>
  <div class="chips">
    <button v-for="[v, l] in [['active', 'Ativas'], ['paused', 'Pausadas'], ['cancelled', 'Canceladas'], ['all', 'Todas']] as const"
      :key="v" :class="{ on: filter === v }" @click="filter = v">{{ l }}</button>
  </div>
  <p v-if="!shown.length" class="empty">Nada por aqui.</p>
  <ul class="list">
    <li v-for="s in shown" :key="s.id" class="tap" @click="editing = s">
      <span>{{ s.name }}<small v-if="s.status !== 'active'"> · {{ s.status === 'paused' ? 'pausada' : 'cancelada' }}</small></span>
      <span class="grow" />
      <span>{{ formatMoney(s.amountCents, s.currency) }}<small>{{ every(s) }}</small></span>
    </li>
  </ul>
  <button class="fab" aria-label="Nova assinatura" @click="creating = true">+</button>
  <SubscriptionForm v-if="creating || editing" :key="editing?.id ?? 'new'" :initial="editing ?? undefined"
    @save="save" @remove="remove" @cancel="(editing = null), (creating = false)" />
</template>
