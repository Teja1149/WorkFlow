import { DateTime } from 'luxon'

export function nowInTimezone(timezone: string) {
  return DateTime.now().setZone(timezone)
}

export function dateInTimezone(timezone: string) {
  return nowInTimezone(timezone).toISODate()!
}

export function timeInTimezone(timezone: string) {
  return nowInTimezone(timezone).toFormat('HH:mm')
}

export function dayOfWeekInTimezone(timezone: string) {
  return nowInTimezone(timezone).weekday
}

export function formatDateInTimezone(dateStr: string, timezone: string) {
  if (!dateStr) return null
  return DateTime.fromISO(dateStr).setZone(timezone).toISODate()
}
