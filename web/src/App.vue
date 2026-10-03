<script setup lang="ts">
import { computed, ref } from 'vue'
import { summarizeMonth } from './engine/occurrences'
import { todayISO } from './engine/date'
import { useSubscriptions } from './data/store'
import { formatMoney } from './format'

const store = useSubscriptions()
const names = computed(() => Object.fromEntries(store.items.map((s) => [s.id, s.name])))

const today = todayISO()
const [ty, tm] = today.split('-').map(Number)
const cursor = ref({ year: ty, month: tm })

const summary = computed(() => summarizeMonth(store.items, cursor.value.year, cursor.value.month, today))

function shift(delta: number) {
  const idx = cursor.value.year * 12 + cursor.value.month - 1 + delta
  cursor.value = { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}
const label = computed(() =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(cursor.value.year, cursor.value.month - 1, 1),
  ),
)
const fmt = (t: Record<string, number>) =>
  Object.entries(t).map(([c, v]) => formatMoney(v, c)).join(' + ') || formatMoney(0, 'BRL')
</script>

<template>
  <main>
    <nav>
      <button @click="shift(-1)" aria-label="Mês anterior">‹</button>
      <h1>{{ label }}</h1>
      <button @click="shift(1)" aria-label="Próximo mês">›</button>
    </nav>
    <section class="cards">
      <div class="hero"><small>Ainda vai cobrar</small><strong>{{ fmt(summary.remaining) }}</strong></div>
      <div><small>Já cobrado</small><strong>{{ fmt(summary.charged) }}</strong></div>
      <div><small>Total do mês</small><strong>{{ fmt(summary.total) }}</strong></div>
    </section>
    <ul>
      <li v-for="o in summary.occurrences" :key="o.subscriptionId + o.date" :class="{ done: o.date < today }">
        <span>{{ o.date.slice(8) }}/{{ o.date.slice(5, 7) }}</span>
        <span>{{ names[o.subscriptionId] }}</span>
        <span>{{ formatMoney(o.amountCents, o.currency) }}</span>
      </li>
    </ul>
  </main>
</template>

<style>
body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; }
main { max-width: 480px; margin: 0 auto; padding: 16px; }
nav { display: flex; align-items: center; justify-content: space-between; }
nav h1 { font-size: 1.1rem; text-transform: capitalize; }
nav button { background: #1e293b; color: inherit; border: 0; border-radius: 8px; width: 40px; height: 40px; font-size: 1.4rem; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cards div { background: #1e293b; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.cards .hero { grid-column: 1 / -1; background: #1d4ed8; }
.cards small { opacity: .75; }
ul { list-style: none; padding: 0; }
li { display: grid; grid-template-columns: 56px 1fr auto; padding: 12px 0; border-bottom: 1px solid #1e293b; }
li.done { opacity: .45; }
</style>
