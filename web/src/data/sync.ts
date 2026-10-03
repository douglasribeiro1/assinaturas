import type { AppDB } from './db'
import { fromRemote, toRemote } from './mapping'
import type { Remote } from './types'

const LAST_SYNC = 'lastSync'

/**
 * Push the outbox, then pull changes (`updated_at > lastSync`).
 * Conflicts are last-write-wins: the server stamps `updated_at` on every write,
 * and a pulled row never overwrites a local row that still has a pending push.
 * Throws on network failure; the outbox is kept and the next run retries.
 */
export async function sync(db: AppDB, remote: Remote): Promise<{ pushed: number; pulled: number }> {
  const pending = await db.outbox.toArray()
  const rows = (await db.subscriptions.bulkGet(pending.map((p) => p.id))).filter(
    (r): r is NonNullable<typeof r> => !!r,
  )
  if (rows.length) await remote.upsert(rows.map(toRemote))

  // Clear only entries not re-queued while the push was in flight.
  await db.transaction('rw', db.outbox, async () => {
    for (const p of pending) {
      const cur = await db.outbox.get(p.id)
      if (cur && cur.queuedAt === p.queuedAt) await db.outbox.delete(p.id)
    }
  })

  const since = (await db.meta.get(LAST_SYNC))?.value ?? null
  const incoming = await remote.fetchSince(since)
  let pulled = 0
  await db.transaction('rw', db.subscriptions, db.outbox, db.meta, async () => {
    for (const r of incoming) {
      if (await db.outbox.get(r.id)) continue // local edit pending, wins until pushed
      await db.subscriptions.put(fromRemote(r))
      pulled++
    }
    if (incoming.length) {
      await db.meta.put({ key: LAST_SYNC, value: incoming[incoming.length - 1].updated_at })
    }
  })
  return { pushed: rows.length, pulled }
}
