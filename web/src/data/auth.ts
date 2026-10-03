import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const useAuth = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const ready = ref(false)

  // getSession reads the persisted session, so this works offline after the first login.
  async function init(onSignedIn?: () => void) {
    if (!supabase) {
      ready.value = true
      return
    }
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    ready.value = true
    supabase.auth.onAuthStateChange((event, s) => {
      session.value = s
      if (event === 'SIGNED_IN') onSignedIn?.()
    })
  }

  async function signInWithGoogle() {
    if (!supabase) throw new Error('Supabase não configurado')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  return { session, ready, init, signInWithGoogle, signOut }
})
