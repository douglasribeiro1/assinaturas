import type { LocalSubscription, RemoteSubscription } from './types'

export function toRemote(s: LocalSubscription): RemoteSubscription {
  return {
    id: s.id,
    name: s.name,
    amount_cents: s.amountCents,
    currency: s.currency,
    cycle: s.cycle,
    cycle_interval: s.cycleInterval,
    anchor_date: s.anchorDate,
    status: s.status,
    ends_on: s.endsOn ?? null,
    category: s.category ?? null,
    notes: s.notes ?? null,
    remind_days_before: s.remindDaysBefore,
    updated_at: s.updatedAt,
    deleted_at: s.deletedAt ?? null,
  }
}

export function fromRemote(r: RemoteSubscription): LocalSubscription {
  return {
    id: r.id,
    name: r.name,
    amountCents: r.amount_cents,
    currency: r.currency,
    cycle: r.cycle,
    cycleInterval: r.cycle_interval,
    anchorDate: r.anchor_date,
    status: r.status,
    endsOn: r.ends_on,
    category: r.category,
    notes: r.notes,
    remindDaysBefore: r.remind_days_before,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }
}
