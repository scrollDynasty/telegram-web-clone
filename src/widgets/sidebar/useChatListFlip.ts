import { useLayoutEffect, useRef, type RefObject } from 'react'
import { prefersReducedMotion } from '@/shared/lib/motion'

/** Telegram's `--chat-transform-transition: 0.2s ease-out` and `.animate-opacity`. */
const ANIMATION: KeyframeAnimationOptions = { duration: 200, easing: 'ease-out' }

/**
 * Animates chat rows when the list is reordered (a chat with a new message jumps to the top).
 * Same rules as Telegram's useOrderDiff + useChatAnimationType, applied as FLIP on real offsets:
 * the chat that moves against the general flow (usually the one that jumped to the top) and new
 * chats fade in on their new place, all others slide from their previous position.
 * Rows are found by `li[data-chat-id]` inside the list. `resetKey` changes (e.g. the search
 * query) re-measure without animating.
 */
export function useChatListFlip(listRef: RefObject<HTMLElement | null>, resetKey: string) {
  const prev = useRef<{ order: string[]; tops: Map<string, number>; resetKey: string } | null>(null)

  // Runs after every commit; cheap when nothing moved (a few offsetTop reads, then an early return).
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) {
      prev.current = null
      return
    }

    const rows = new Map<string, HTMLElement>()
    for (const el of list.querySelectorAll<HTMLElement>('li[data-chat-id]')) {
      rows.set(el.dataset.chatId!, el)
    }
    const order = [...rows.keys()]
    // offsetTop, not getBoundingClientRect: scrolling the list must not look like movement.
    const tops = new Map(order.map((id) => [id, rows.get(id)!.offsetTop]))

    const last = prev.current
    prev.current = { order, tops, resetKey }
    if (
      !last ||
      last.resetKey !== resetKey ||
      last.order.join(',') === order.join(',') ||
      typeof Element.prototype.animate !== 'function' ||
      prefersReducedMotion()
    ) {
      return
    }

    const prevIndex = new Map(last.order.map((id, i) => [id, i]))
    const diffs = new Map<string, number>()
    let numberOfUp = 0
    let numberOfDown = 0
    order.forEach((id, index) => {
      const before = prevIndex.get(id)
      const diff = before === undefined ? -Infinity : index - before
      diffs.set(id, diff)
      if (diff < 0) numberOfUp++
      else if (diff > 0) numberOfDown++
    })

    for (const [id, el] of rows) {
      const diff = diffs.get(id)!
      const prevTop = last.tops.get(id)
      const isNew = prevTop === undefined
      const fade =
        isNew || (numberOfUp <= numberOfDown && diff < 0) || (numberOfDown < numberOfUp && diff > 0)

      if (fade) {
        el.getAnimations().forEach((a) => a.cancel())
        el.animate([{ opacity: 0 }, { opacity: 1 }], ANIMATION)
        continue
      }
      const dy = prevTop - tops.get(id)!
      if (dy === 0) continue
      el.getAnimations().forEach((a) => a.cancel())
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], ANIMATION)
    }
  })
}
