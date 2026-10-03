import Dexie, { type Table } from 'dexie'
import type { LocalSubscription, OutboxEntry } from './types'

export class AppDB extends Dexie {
  subscriptions!: Table<LocalSubscription, string>
  outbox!: Table<OutboxEntry, string>
  meta!: Table<{ key: string; value: string }, string>

  constructor(name = 'assinaturas') {
    super(name)
    this.version(1).stores({
      subscriptions: 'id, updatedAt, deletedAt',
      outbox: 'id',
      meta: 'key',
    })
  }
}

export const db = new AppDB()
