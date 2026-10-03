<script setup lang="ts">
import { computed, ref } from 'vue'
import { summarizeMonth } from '../engine/occurrences'
import { todayISO } from '../engine/date'
import { useSubscriptions } from '../data/store'
import { formatMoney } from '../format'

const store = useSubscriptions()
const today = todayISO()
const [ty, tm] = today.split('-').map(Number)
const cursor = ref({ year: ty, month: tm })

const names = computed(() => Object.fromEntries(store.items.map((s) => [s.id, s.name])))
const summary = computed(() => summarizeMonth(store.items, cursor.value.year, cursor.value.month, today))
const label = computed(() =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(cursor.value.year, cursor.value.month - 1, 1),
  ),
)

function shift(delta: number) {
  const idx = cursor.value.year * 12 + cursor.value.month - 1 + delta
  cursor.value = { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}
const fmt = (t: Record<string, number>) =>
  Object.entries(t).map(([c, v]) => formatMoney(v, c)).join(' + ') || formatMoney(0, 'BRL')
</script>

<template>
  <nav class="month">
    <button @click="shift(-1)" aria-label="Mês anterior">‹</button>
    <h1>{{ label }}</h1>
    <button @click="shift(1)" aria-label="Próximo mês">›</button>
  </nav>
  <section class="cards">
    <div class="hero"><small>Ainda vai cobrar</small><strong>{{ fmt(summary.remaining) }}</strong></div>
    <div><small>Já cobrado</small><strong>{{ fmt(summary.charged) }}</strong></div>
    <div><small>Total do mês</small><strong>{{ fmt(summary.total) }}</strong></div>
  </section>
  <p v-if="!summary.occurrences.length" class="empty">
    {{ store.items.length ? 'Nenhuma cobrança neste mês.' : 'Nenhuma assinatura ainda. Toque em Assinaturas para adicionar.' }}
  </p>
  <ul class="list">
    <li v-for="o in summary.occurrences" :key="o.subscriptionId + o.date" :class="{ done: o.date < today }">
      <span class="date">{{ o.date.slice(8) }}/{{ o.date.slice(5, 7) }}</span>
      <span>{{ names[o.subscriptionId] }}</span>
      <span>{{ formatMoney(o.amountCents, o.currency) }}</span>
    </li>
  </ul>
</template>
