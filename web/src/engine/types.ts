export type Cycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type Status = 'active' | 'paused' | 'cancelled'

/** Date-only string, `YYYY-MM-DD`. No time zone involved. */
export type ISODate = string

export interface Subscription {
  id: string
  name: string
  amountCents: number
  currency: string
  cycle: Cycle
  /** Charge every N cycles (>= 1). */
  cycleInterval: number
  /** First charge date (or any past charge date) used as the base. */
  anchorDate: ISODate
  status: Status
  /** Last day on which a charge can occur (inclusive). */
  endsOn?: ISODate | null
}

export interface Occurrence {
  subscriptionId: string
  date: ISODate
  amountCents: number
  currency: string
}

/** Totals in cents, keyed by currency code. */
export type Totals = Record<string, number>

export interface MonthSummary {
  year: number
  /** 1-12 */
  month: number
  total: Totals
  /** Charges dated before `today`. */
  charged: Totals
  /** Charges dated today or later (today's charge still counts as pending). */
  remaining: Totals
  occurrences: Occurrence[]
}
