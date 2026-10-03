import type { Subscription } from '../engine/types'

/** Subscription as stored locally and synced. Timestamps are ISO strings (UTC). */
export interface LocalSubscription extends Subscription {
  category?: string | null
  notes?: string | null
  remindDaysBefore: number
  updatedAt: string
  /** Soft delete: the row stays so the deletion can sync. */
  deletedAt?: string | null
}

/** One pending push per subscription; the payload is read from the table at push time. */
export interface OutboxEntry {
  id: string
  queuedAt: string
}

/** Row shape of `public.subscriptions` on the server. */
export interface RemoteSubscription {
  id: string
  name: string
  amount_cents: number
  currency: string
  cycle: Subscription['cycle']
  cycle_interval: number
  anchor_date: string
  status: Subscription['status']
  ends_on: string | null
  category: string | null
  notes: string | null
  remind_days_before: number
  updated_at: string
  deleted_at: string | null
}

export interface Remote {
  upsert(rows: RemoteSubscription[]): Promise<void>
  /** Rows with `updated_at > since`, oldest first. */
  fetchSince(since: string | null): Promise<RemoteSubscription[]>
}
