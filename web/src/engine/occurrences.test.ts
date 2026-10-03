import { describe, expect, it } from 'vitest'
import { occurrencesBetween, summarizeMonth } from './occurrences'
import type { Subscription } from './types'

const base: Subscription = {
  id: 's1',
  name: 'Streaming',
  amountCents: 3990,
  currency: 'BRL',
  cycle: 'monthly',
  cycleInterval: 1,
  anchorDate: '2025-01-15',
  status: 'active',
}
const dates = (s: Subscription, from: string, to: string) =>
  occurrencesBetween(s, from, to).map((o) => o.date)

describe('monthly', () => {
  it('charges on the same day each month', () => {
    expect(dates(base, '2025-01-01', '2025-04-30')).toEqual([
      '2025-01-15', '2025-02-15', '2025-03-15', '2025-04-15',
    ])
  })

  it('clamps day 31 to month end without drifting', () => {
    const s = { ...base, anchorDate: '2025-01-31' }
    expect(dates(s, '2025-01-01', '2025-05-31')).toEqual([
      '2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30', '2025-05-31',
    ])
  })

  it('uses Feb 29 in leap years', () => {
    const s = { ...base, anchorDate: '2024-01-31' }
    expect(dates(s, '2024-02-01', '2024-02-29')).toEqual(['2024-02-29'])
    expect(dates(s, '2025-02-01', '2025-02-28')).toEqual(['2025-02-28'])
  })

  it('supports every N months', () => {
    const s = { ...base, cycleInterval: 2 }
    expect(dates(s, '2025-01-01', '2025-07-31')).toEqual([
      '2025-01-15', '2025-03-15', '2025-05-15', '2025-07-15',
    ])
  })

  it('does not charge before the anchor', () => {
    expect(dates(base, '2024-01-01', '2024-12-31')).toEqual([])
  })

  it('crosses year boundaries', () => {
    expect(dates(base, '2025-12-01', '2026-01-31')).toEqual(['2025-12-15', '2026-01-15'])
  })

  it('works far from the anchor', () => {
    expect(dates(base, '2030-06-01', '2030-06-30')).toEqual(['2030-06-15'])
  })
})

describe('quarterly and yearly', () => {
  it('quarterly', () => {
    const s = { ...base, cycle: 'quarterly' as const }
    expect(dates(s, '2025-01-01', '2025-12-31')).toEqual([
      '2025-01-15', '2025-04-15', '2025-07-15', '2025-10-15',
    ])
  })

  it('yearly on Feb 29 falls back to Feb 28 in common years', () => {
    const s = { ...base, cycle: 'yearly' as const, anchorDate: '2024-02-29' }
    expect(dates(s, '2024-01-01', '2028-12-31')).toEqual([
      '2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29',
    ])
  })
})

describe('weekly', () => {
  it('every 7 days, across month ends', () => {
    const s = { ...base, cycle: 'weekly' as const, anchorDate: '2025-01-27' }
    expect(dates(s, '2025-01-27', '2025-02-17')).toEqual([
      '2025-01-27', '2025-02-03', '2025-02-10', '2025-02-17',
    ])
  })

  it('every 2 weeks, starting mid-range', () => {
    const s = { ...base, cycle: 'weekly' as const, cycleInterval: 2, anchorDate: '2025-01-01' }
    expect(dates(s, '2025-02-01', '2025-02-28')).toEqual(['2025-02-12', '2025-02-26'])
  })

  it('is not affected by DST (uses calendar days)', () => {
    const s = { ...base, cycle: 'weekly' as const, anchorDate: '2025-03-01' }
    expect(dates(s, '2025-03-01', '2025-04-05')).toEqual([
      '2025-03-01', '2025-03-08', '2025-03-15', '2025-03-22', '2025-03-29', '2025-04-05',
    ])
  })
})

describe('status and end date', () => {
  it('paused and cancelled never charge', () => {
    expect(dates({ ...base, status: 'paused' }, '2025-01-01', '2025-12-31')).toEqual([])
    expect(dates({ ...base, status: 'cancelled' }, '2025-01-01', '2025-12-31')).toEqual([])
  })

  it('endsOn is inclusive', () => {
    const s = { ...base, endsOn: '2025-03-15' }
    expect(dates(s, '2025-01-01', '2025-12-31')).toEqual([
      '2025-01-15', '2025-02-15', '2025-03-15',
    ])
  })

  it('rejects invalid intervals', () => {
    expect(() => occurrencesBetween({ ...base, cycleInterval: 0 }, '2025-01-01', '2025-02-01')).toThrow()
  })
})

describe('summarizeMonth', () => {
  const subs: Subscription[] = [
    { ...base, id: 'a', anchorDate: '2025-01-05', amountCents: 1000 },
    { ...base, id: 'b', anchorDate: '2025-01-20', amountCents: 2500 },
    { ...base, id: 'c', anchorDate: '2025-01-10', amountCents: 500, currency: 'USD' },
  ]

  it('splits charged vs remaining by today', () => {
    const r = summarizeMonth(subs, 2025, 3, '2025-03-12')
    expect(r.total).toEqual({ BRL: 3500, USD: 500 })
    expect(r.charged).toEqual({ BRL: 1000, USD: 500 })
    expect(r.remaining).toEqual({ BRL: 2500 })
    expect(r.occurrences.map((o) => o.date)).toEqual(['2025-03-05', '2025-03-10', '2025-03-20'])
  })

  it("counts today's charge as remaining", () => {
    const r = summarizeMonth(subs, 2025, 3, '2025-03-20')
    expect(r.remaining).toEqual({ BRL: 2500 })
  })

  it('future month has everything remaining; past month nothing', () => {
    expect(summarizeMonth(subs, 2025, 6, '2025-03-12').charged).toEqual({})
    expect(summarizeMonth(subs, 2025, 1, '2025-03-12').remaining).toEqual({})
  })
})
