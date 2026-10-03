import type { ISODate } from './types.ts'

export interface YMD {
  y: number
  /** 1-12 */
  m: number
  d: number
}

export function parseISO(s: ISODate): YMD {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) throw new Error(`Invalid date: ${s}`)
  const ymd = { y: +match[1], m: +match[2], d: +match[3] }
  if (ymd.m < 1 || ymd.m > 12 || ymd.d < 1 || ymd.d > daysInMonth(ymd.y, ymd.m)) {
    throw new Error(`Invalid date: ${s}`)
  }
  return ymd
}

export function formatISO({ y, m, d }: YMD): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

/** Days since 1970-01-01 (UTC, so no DST artifacts). */
export function toEpochDay({ y, m, d }: YMD): number {
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function fromEpochDay(n: number): YMD {
  const dt = new Date(n * 86_400_000)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

/** Today's local date as ISO (the user's calendar day, not UTC). */
export function todayISO(now: Date = new Date()): ISODate {
  return formatISO({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() })
}

export function monthRange(year: number, month: number): { from: ISODate; to: ISODate } {
  return {
    from: formatISO({ y: year, m: month, d: 1 }),
    to: formatISO({ y: year, m: month, d: daysInMonth(year, month) }),
  }
}
