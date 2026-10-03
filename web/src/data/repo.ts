import type { AppDB } from './db'
import type { LocalSubscription } from './types'

export type SubscriptionInput = Omit<LocalSubscription, 'id' | 'updatedAt' | 'deletedAt'>

/** All writes go to Dexie and the outbox in one transaction; the UI never waits on the network. */
export function createRepo(db: AppDB, now: () => Date = () => new Date()) {
  async function write(row: LocalSubscription): Promise<void> {
    await db.transaction('rw', db.subscriptions, db.outbox, async () => {
      await db.subscriptions.put(row)
      await db.outbox.put({ id: row.id, queuedAt: row.updatedAt })
    })
  }

  return {
    async create(input: SubscriptionInput): Promise<LocalSubscription> {
      const row: LocalSubscription = {
        ...input,
        id: crypto.randomUUID(),
        updatedAt: now().toISOString(),
        deletedAt: null,
      }
      await write(row)
      return row
    },

    async update(id: string, patch: Partial<SubscriptionInput>): Promise<LocalSubscription> {
      const current = await db.subscriptions.get(id)
      if (!current || current.deletedAt) throw new Error(`Subscription not found: ${id}`)
      const row = { ...current, ...patch, updatedAt: now().toISOString() }
      await write(row)
      return row
    },

    async remove(id: string): Promise<void> {
      const current = await db.subscriptions.get(id)
      if (!current || current.deletedAt) return
      const stamp = now().toISOString()
      await write({ ...current, deletedAt: stamp, updatedAt: stamp })
    },

    /** Live (non-deleted) subscriptions. */
    async list(): Promise<LocalSubscription[]> {
      return (await db.subscriptions.toArray()).filter((s) => !s.deletedAt)
    },
  }
}
