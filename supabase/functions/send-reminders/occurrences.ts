import { daysInMonth, formatISO, fromEpochDay, monthRange, parseISO, toEpochDay } from './date.ts'
import type {
  Cycle,
  ISODate,
  MonthSummary,
  Occurrence,
  Subscription,
  Totals,
} from './types.ts'

const MONTHS_PER_CYCLE: Record<Exclude<Cycle, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

/**
 * Date of the k-th charge (k = 0 is the anchor). Always derived from the
 * anchor rather than from the previous charge, so a day-31 subscription goes
 * Jan 31 -> Feb 28 -> Mar 31 instead of drifting to the 28th forever.
 */
function chargeDate(sub: Subscription, k: number): ISODate {
  const a = parseISO(sub.anchorDate)
  if (sub.cycle === 'weekly') {
    return formatISO(fromEpochDay(toEpochDay(a) + 7 * sub.cycleInterval * k))
  }
  const totalMonths = a.y * 12 + (a.m - 1) + MONTHS_PER_CYCLE[sub.cycle] * sub.cycleInterval * k
  const y = Math.floor(totalMonths / 12)
  const m = (totalMonths % 12) + 1
  return formatISO({ y, m, d: Math.min(a.d, daysInMonth(y, m)) })
}

/** Smallest k >= 0 whose charge date might be >= `from` (never overshoots). */
function firstCandidate(sub: Subscription, from: ISODate): number {
  const a = parseISO(sub.anchorDate)
  const f = parseISO(from)
  if (sub.cycle === 'weekly') {
    const diff = toEpochDay(f) - toEpochDay(a)
    return diff <= 0 ? 0 : Math.floor(diff / (7 * sub.cycleInterval))
  }
  const monthsDiff = (f.y * 12 + f.m) - (a.y * 12 + a.m)
  const step = MONTHS_PER_CYCLE[sub.cycle] * sub.cycleInterval
  return monthsDiff <= 0 ? 0 : Math.max(0, Math.floor(monthsDiff / step) - 1)
}

/** Charges of one subscription with `from <= date <= to` (both inclusive). */
export function occurrencesBetween(
  sub: Subscription,
  from: ISODate,
  to: ISODate,
): Occurrence[] {
  if (sub.status !== 'active') return []
  if (!Number.isInteger(sub.cycleInterval) || sub.cycleInterval < 1) {
    throw new Error(`Invalid cycleInterval: ${sub.cycleInterval}`)
  }
  // ISO strings compare chronologically.
  const last = sub.endsOn && sub.endsOn < to ? sub.endsOn : to
  const out: Occurrence[] = []
  for (let k = firstCandidate(sub, from); ; k++) {
    const date = chargeDate(sub, k)
    if (date > last) break
    if (date >= from) {
      out.push({
        subscriptionId: sub.id,
        date,
        amountCents: sub.amountCents,
        currency: sub.currency,
      })
    }
  }
  return out
}

function add(totals: Totals, currency: string, cents: number): void {
  totals[currency] = (totals[currency] ?? 0) + cents
}

/**
 * Monthly summary. A charge dated `today` counts as still pending, so on the
 * day itself "remaining" includes it.
 */
export function summarizeMonth(
  subs: Subscription[],
  year: number,
  month: number,
  today: ISODate,
): MonthSummary {
  const { from, to } = monthRange(year, month)
  const occurrences = subs
    .flatMap((s) => occurrencesBetween(s, from, to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.subscriptionId.localeCompare(b.subscriptionId))

  const total: Totals = {}
  const charged: Totals = {}
  const remaining: Totals = {}
  for (const o of occurrences) {
    add(total, o.currency, o.amountCents)
    add(o.date < today ? charged : remaining, o.currency, o.amountCents)
  }
  return { year, month, total, charged, remaining, occurrences }
}
