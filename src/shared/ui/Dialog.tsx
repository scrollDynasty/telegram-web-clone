import clsx from 'clsx'
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { usePresence } from '@/shared/lib/usePresence'
import styles from './Dialog.module.css'

/** Telegram's Modal ANIMATION_DURATION is 200ms; the timeout only backs up animationend. */
const CLOSE_TIMEOUT_MS = 250

interface DialogProps {
  open: boolean
  onClose: () => void
  /**
   * After the exit animation, once the native close has handed focus back to the opener:
   * the place to move focus somewhere more useful (e.g. into a chat the dialog opened).
   */
  onClosed?: () => void
  title: string
  description?: ReactNode
  /** 26.25rem instead of the 24rem confirm width (Telegram's `.slim` modal). */
  wide?: boolean
  children: ReactNode
}

/**
 * Native <dialog>: focus trapping, Esc handling and inert background come for free.
 * Closing plays an exit animation first (data-closing), then calls dialog.close().
 */
export function Dialog({
  open,
  onClose,
  onClosed,
  title,
  description,
  wide,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const presence = usePresence(open, CLOSE_TIMEOUT_MS)

  // Layout effect: close in the same frame the closing state ends, before the open animation
  // could flash again.
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal?.()
      // React's autoFocus fires while the dialog is still closed (not focusable), and showModal
      // then focuses the first control. Honour an explicit initial focus instead.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!presence.mounted && dialog.open) {
      dialog.close?.()
      onClosed?.()
    }
  }, [open, presence.mounted, onClosed])

  return (
    // The dialog element itself handles keyboard (Esc); the click only covers the backdrop.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className={clsx(styles.dialog, wide && styles.wide)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-closing={presence.closing || undefined}
      onClose={onClose}
      // Esc goes through the same animated close as the buttons and the backdrop. Handled on
      // keydown (cancelling it suppresses the native close request); onCancel covers the other
      // close requests, e.g. the Android back gesture.
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault()
          onClose()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && !event.pseudoElement && presence.closing) {
          presence.done()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {presence.mounted && (
        <>
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          </div>
          <div className={styles.content}>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
            {children}
          </div>
        </>
      )}
    </dialog>
  )
}

/** Row of text buttons at the bottom of a dialog; put the primary action first. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>
}
