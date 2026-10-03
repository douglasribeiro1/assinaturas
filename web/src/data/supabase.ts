import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Remote } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Null when env vars are missing: the app then runs local-only. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export function createSupabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(rows) {
      const { error } = await client.from('subscriptions').upsert(rows)
      if (error) throw error
    },
    async fetchSince(since) {
      let q = client.from('subscriptions').select('*').order('updated_at', { ascending: true })
      if (since) q = q.gt('updated_at', since)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  }
}
