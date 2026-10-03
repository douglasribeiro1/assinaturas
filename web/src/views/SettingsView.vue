<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuth } from '../data/auth'
import { useSubscriptions } from '../data/store'
import { currentPush, disablePush, enablePush, pushSupported } from '../data/push'
import { CURRENCIES, settings } from '../settings'

const auth = useAuth()
const store = useSubscriptions()
const pushOn = ref(false)
const msg = ref('')

onMounted(async () => (pushOn.value = !!(await currentPush())))

async function run(fn: () => Promise<void>) {
  msg.value = ''
  try {
    await fn()
  } catch (e) {
    msg.value = e instanceof Error ? e.message : String(e)
  }
}
const togglePush = () =>
  run(async () => {
    if (pushOn.value) await disablePush()
    else await enablePush()
    pushOn.value = !!(await currentPush())
  })
</script>

<template>
  <h1>Configurações</h1>
  <section class="panel">
    <h2>Conta</h2>
    <template v-if="auth.session">
      <p>{{ auth.session.user.email }}</p>
      <p class="muted">{{ store.syncing ? 'Sincronizando…' : store.lastError ? `Erro de sync: ${store.lastError}` : 'Sincronizado' }}</p>
      <button class="ghost" @click="store.runSync()">Sincronizar agora</button>
      <button class="ghost" @click="run(auth.signOut)">Sair</button>
    </template>
    <template v-else>
      <p class="muted">Entre para sincronizar entre aparelhos e receber lembretes. Sem login, os dados ficam só neste aparelho.</p>
      <button class="primary" @click="run(auth.signInWithGoogle)">Entrar com Google</button>
    </template>
  </section>
  <section class="panel">
    <h2>Padrões</h2>
    <label>Moeda padrão
      <select v-model="settings.defaultCurrency"><option v-for="c in CURRENCIES" :key="c">{{ c }}</option></select>
    </label>
    <label>Lembrar (dias antes) em novas assinaturas
      <input v-model.number="settings.defaultRemindDays" type="number" min="0" max="30" />
    </label>
  </section>
  <section class="panel">
    <h2>Lembretes</h2>
    <p v-if="!pushSupported()" class="muted">Notificações push não estão disponíveis aqui (instale o app e configure o Supabase).</p>
    <template v-else>
      <p class="muted">Receba um aviso antes de cada cobrança.</p>
      <button :class="pushOn ? 'ghost' : 'primary'" :disabled="!auth.session" @click="togglePush">
        {{ pushOn ? 'Desativar notificações' : 'Ativar notificações' }}
      </button>
      <p v-if="!auth.session" class="muted">Entre com Google primeiro.</p>
    </template>
  </section>
  <p v-if="msg" class="error">{{ msg }}</p>
</template>
