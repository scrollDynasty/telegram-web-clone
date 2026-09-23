/** Shared with widgets/chat/Composer: the message field of the open chat. */
export const COMPOSER_INPUT_ID = 'composer-input'

/** On phones, focusing a text field pops the keyboard over the conversation. */
export function isCoarsePointer(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

/**
 * Moves focus into the open chat, e.g. after a modal that opened it has closed (a modal's own
 * close hands focus back to its opener). Touch devices get the message log, not the keyboard.
 */
export function focusOpenChat(): void {
  const target = isCoarsePointer()
    ? document.querySelector<HTMLElement>('[role="log"]')
    : document.getElementById(COMPOSER_INPUT_ID)
  target?.focus({ preventScroll: true })
}
