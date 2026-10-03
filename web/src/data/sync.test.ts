import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { fromRemote, toRemote } from './mapping'
import { createRepo, type SubscriptionInput } from './repo'
import { sync } from './sync'
import type { Remote, RemoteSubscription } from './types'

const input: SubscriptionInput = {
  name: 'Streaming', amountCents: 3990, currency: 'BRL', cycle: 'monthly',
  cycleInterval: 1, anchorDate: '2025-01-15', status: 'active', remindDaysBefore: 1,
}

/** In-memory server: stamps updated_at itself, like the Postgres trigger/default. */
function fakeServer() {
  const rows = new Map<string, RemoteSubscription>()
  let clock = 0
  const stamp = () => new Date(Date.UTC(2025, 0, 1, 0, 0, ++clock)).toISOString()
  const remote: Remote & { fail: boolean } = {
    fail: false,
    async upsert(batch) {
      if (this.fail) throw new Error('offline')
      for (const r of batch) rows.set(r.id, { ...r, updated_at: stamp() })
    },
    async fetchSince(since) {
      if (this.fail) throw new Error('offline')
      return [...rows.values()]
        .filter((r) => !since || r.updated_at > since)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    },
  }
  return { rows, remote }
}

let db: AppDB
beforeEach(() => { db = new AppDB(`t-${Math.random()}`) })

describe('repo', () => {
  it('writes locally and queues an outbox entry', async () => {
    const repo = createRepo(db)
    const s = await repo.create(input)
    expect(await repo.list()).toHaveLength(1)
    expect((await db.outbox.toArray()).map((o) => o.id)).toEqual([s.id])
  })

  it('soft-deletes and hides from list but keeps the row', async () => {
    const repo = createRepo(db)
    const s = await repo.create(input)
    await repo.remove(s.id)
    expect(await repo.list()).toHaveLength(0)
    expect((await db.subscriptions.get(s.id))?.deletedAt).toBeTruthy()
  })

  it('coalesces several edits into one outbox entry', async () => {
    const repo = createRepo(db)
    const s = await repo.create(input)
    await repo.update(s.id, { name: 'A' })
    await repo.update(s.id, { name: 'B' })
    expect(await db.outbox.count()).toBe(1)
  })
})

describe('sync', () => {
  it('pushes the outbox and clears it', async () => {
    const { rows, remote } = fakeServer()
    const s = await createRepo(db).create(input)
    const r = await sync(db, remote)
    expect(r.pushed).toBe(1)
    expect(rows.get(s.id)?.name).toBe('Streaming')
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps the outbox when offline and retries later', async () => {
    const { rows, remote } = fakeServer()
    const s = await createRepo(db).create(input)
    remote.fail = true
    await expect(sync(db, remote)).rejects.toThrow('offline')
    expect(await db.outbox.count()).toBe(1)
    remote.fail = false
    await sync(db, remote)
    expect(rows.has(s.id)).toBe(true)
  })

  it('pulls remote changes incrementally', async () => {
    const { rows, remote } = fakeServer()
    const other = new AppDB(`t-${Math.random()}`)
    const s = await createRepo(other).create(input)
    await sync(other, remote)

    expect((await sync(db, remote)).pulled).toBe(1)
    expect((await db.subscriptions.get(s.id))?.name).toBe('Streaming')
    expect((await sync(db, remote)).pulled).toBe(0) // nothing new

    await createRepo(other).update(s.id, { name: 'Renamed' })
    await sync(other, remote)
    expect((await sync(db, remote)).pulled).toBe(1)
    expect((await db.subscriptions.get(s.id))?.name).toBe('Renamed')
    expect(rows.size).toBe(1)
  })

  it('propagates deletions', async () => {
    const { remote } = fakeServer()
    const other = new AppDB(`t-${Math.random()}`)
    const repoOther = createRepo(other)
    const s = await repoOther.create(input)
    await sync(other, remote)
    await sync(db, remote)
    await repoOther.remove(s.id)
    await sync(other, remote)
    await sync(db, remote)
    expect(await createRepo(db).list()).toHaveLength(0)
  })

  it('an edit made during the push stays queued and is not overwritten by the pull', async () => {
    const { remote } = fakeServer()
    const repo = createRepo(db)
    const s = await repo.create(input)
    const racing: Remote = {
      fetchSince: remote.fetchSince,
      async upsert(rows) {
        await remote.upsert(rows)
        await new Promise((r) => setTimeout(r, 2))
        await repo.update(s.id, { name: 'Edited mid-push' })
      },
    }
    await sync(db, racing)
    expect((await db.subscriptions.get(s.id))?.name).toBe('Edited mid-push')
    expect(await db.outbox.count()).toBe(1)
    await sync(db, remote)
    expect(await db.outbox.count()).toBe(0)
  })
})
