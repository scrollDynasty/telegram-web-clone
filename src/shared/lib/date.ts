const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })
const shortDateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayWithYearFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function formatTime(ts: number): string {
  return timeFormat.format(ts)
}

/** Compact timestamp for the chat list: time today, weekday this week, date otherwise. */
export function formatChatListTime(ts: number, now = Date.now()): string {
  const diffDays = (startOfDay(now) - startOfDay(ts)) / DAY_MS
  if (diffDays <= 0) return formatTime(ts)
  if (diffDays < 7) return weekdayFormat.format(ts)
  return shortDateFormat.format(ts)
}

/** Separator label inside a conversation. */
export function formatDayLabel(ts: number, now = Date.now()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS)
  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  return new Date(ts).getFullYear() === new Date(now).getFullYear()
    ? dayFormat.format(ts)
    : dayWithYearFormat.format(ts)
}
