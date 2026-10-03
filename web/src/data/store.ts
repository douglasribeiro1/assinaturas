import { defineStore } from 'pinia'
import { liveQuery } from 'dexie'
import { ref } from 'vue'
import { db } from './db'
import { createRepo } from './repo'
import { sync } from './sync'
import { createSupabaseRemote, supabase } from './supabase'
import type { LocalSubscription } from './types'

export const repo = createRepo(db)

export const useSubscriptions = defineStore('subscriptions', () => {
  const items = ref<LocalSubscription[]>([])
  const syncing = ref(false)
  const lastError = ref<string | null>(null)

  // UI reads only from Dexie; this keeps `items` current after any local or sync write.
  liveQuery(() => repo.list()).subscribe({ next: (v) => (items.value = v) })

  /** No-op without Supabase config or a session (login arrives in a later step). */
  async function runSync() {
    if (!supabase || syncing.value) return
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    syncing.value = true
    try {
      await sync(db, createSupabaseRemote(supabase))
      lastError.value = null
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      syncing.value = false
    }
  }

  async function create(...args: Parameters<typeof repo.create>) {
    const row = await repo.create(...args)
    void runSync()
    return row
  }
  async function update(...args: Parameters<typeof repo.update>) {
    const row = await repo.update(...args)
    void runSync()
    return row
  }
  async function remove(id: string) {
    await repo.remove(id)
    void runSync()
  }

  return { items, syncing, lastError, runSync, create, update, remove }
})
