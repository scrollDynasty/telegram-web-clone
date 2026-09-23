import type { MessageStatus } from '../model'
import type { TickAnimation } from './MessageStatusIcon'

export type Glyph = 'clock' | 'tick' | 'double' | 'failed'

export function glyphOf(status: MessageStatus): Glyph {
  switch (status) {
    case 'pending':
      return 'clock'
    case 'sent':
    case 'delivered':
      return 'tick'
    case 'read':
      return 'double'
    case 'failed':
      return 'failed'
  }
}

export const isTicks = (glyph: Glyph) => glyph === 'tick' || glyph === 'double'

/**
 * What to draw when the glyph changes: only the tick that was not there before.
 * `previous` is the animation still attached to the icon, so ✓ → ✓✓ right after clock → ✓
 * lets the first tick finish drawing instead of snapping it to full.
 */
export function animationFor(from: Glyph, to: Glyph, previous: TickAnimation): TickAnimation {
  if (from === 'tick' && to === 'double') return previous === 'first' ? 'first+second' : 'second'
  if (isTicks(to) && !isTicks(from)) return 'first'
  return null
}
