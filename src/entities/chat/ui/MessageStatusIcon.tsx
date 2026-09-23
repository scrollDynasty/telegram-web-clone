import type { MessageStatus } from '../model'

const LABELS: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
}

/** Telegram-like status glyphs; the color comes from `currentColor` of the context. */
export function MessageStatusIcon({ status, size = 19 }: { status: MessageStatus; size?: number }) {
  const common = {
    role: 'img' as const,
    'aria-label': LABELS[status],
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flex: 'none', display: 'block' },
  }

  switch (status) {
    case 'pending': {
      const small = size - 4
      return (
        <svg {...common} width={small} height={small} strokeWidth={2.2}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      )
    }
    case 'sent':
      return (
        <svg {...common} width={size} height={size}>
          <path d="m4.5 12.5 4.5 4.5L19 7" />
        </svg>
      )
    case 'delivered':
    case 'read':
      // Second tick overlaps the first one's long stroke, as in Telegram's double check.
      return (
        <svg {...common} width={size} height={size}>
          <path d="m1.5 12.5 4.5 4.5L16 7" />
          <path d="m11 15.5 1.5 1.5L22.5 7" />
        </svg>
      )
    case 'failed':
      return (
        <svg {...common} width={size} height={size} stroke="none">
          <circle cx="12" cy="12" r="8" fill="var(--danger)" />
          <path d="M12 7.8v4.9M12 16.2v.01" stroke="#fff" strokeWidth={2.2} />
        </svg>
      )
  }
}
