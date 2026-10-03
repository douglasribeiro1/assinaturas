<script setup lang="ts">
import { reactive } from 'vue'
import type { LocalSubscription } from '../data/types'
import type { Cycle, Status } from '../engine/types'
import { todayISO } from '../engine/date'
import { CURRENCIES, settings } from '../settings'

const props = defineProps<{ initial?: LocalSubscription }>()
const emit = defineEmits<{
  save: [data: Omit<LocalSubscription, 'id' | 'updatedAt' | 'deletedAt'>]
  remove: []
  cancel: []
}>()

const i = props.initial
const f = reactive({
  name: i?.name ?? '',
  amount: i ? (i.amountCents / 100).toFixed(2).replace('.', ',') : '',
  currency: i?.currency ?? settings.defaultCurrency,
  cycle: (i?.cycle ?? 'monthly') as Cycle,
  cycleInterval: i?.cycleInterval ?? 1,
  anchorDate: i?.anchorDate ?? todayISO(),
  status: (i?.status ?? 'active') as Status,
  endsOn: i?.endsOn ?? '',
  category: i?.category ?? '',
  remindDaysBefore: i?.remindDaysBefore ?? settings.defaultRemindDays,
})

function submit() {
  const cents = Math.round(parseFloat(f.amount.replace(/\./g, '').replace(',', '.')) * 100)
  if (!f.name.trim() || !Number.isFinite(cents) || cents < 0) return
  emit('save', {
    name: f.name.trim(),
    amountCents: cents,
    currency: f.currency,
    cycle: f.cycle,
    cycleInterval: Math.max(1, Math.floor(f.cycleInterval) || 1),
    anchorDate: f.anchorDate,
    status: f.status,
    endsOn: f.endsOn || null,
    category: f.category.trim() || null,
    notes: i?.notes ?? null,
    remindDaysBefore: f.remindDaysBefore,
  })
}
</script>

<template>
  <div class="sheet" @click.self="emit('cancel')">
    <form @submit.prevent="submit">
      <h2>{{ initial ? 'Editar assinatura' : 'Nova assinatura' }}</h2>
      <label>Nome<input v-model="f.name" required maxlength="80" /></label>
      <div class="row">
        <label>Valor<input v-model="f.amount" inputmode="decimal" required placeholder="39,90" /></label>
        <label>Moeda
          <select v-model="f.currency"><option v-for="c in CURRENCIES" :key="c">{{ c }}</option></select>
        </label>
      </div>
      <div class="row">
        <label>A cada
          <input v-model.number="f.cycleInterval" type="number" min="1" max="52" />
        </label>
        <label>Ciclo
          <select v-model="f.cycle">
            <option value="weekly">semana(s)</option>
            <option value="monthly">mês(es)</option>
            <option value="quarterly">trimestre(s)</option>
            <option value="yearly">ano(s)</option>
          </select>
        </label>
      </div>
      <label>Primeira cobrança (ou data base)<input v-model="f.anchorDate" type="date" required /></label>
      <label>Termina em (opcional)<input v-model="f.endsOn" type="date" :min="f.anchorDate" /></label>
      <div class="row">
        <label>Status
          <select v-model="f.status">
            <option value="active">Ativa</option><option value="paused">Pausada</option><option value="cancelled">Cancelada</option>
          </select>
        </label>
        <label>Lembrar (dias antes)<input v-model.number="f.remindDaysBefore" type="number" min="0" max="30" /></label>
      </div>
      <label>Categoria (opcional)<input v-model="f.category" maxlength="40" /></label>
      <div class="actions">
        <button v-if="initial" type="button" class="danger" @click="emit('remove')">Excluir</button>
        <span class="spacer" />
        <button type="button" class="ghost" @click="emit('cancel')">Cancelar</button>
        <button type="submit" class="primary">Salvar</button>
      </div>
    </form>
  </div>
</template>
