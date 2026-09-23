import clsx from 'clsx'
import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_MESSAGE_LENGTH } from '@/features/send-message/useSendMessage'
import { COMPOSER_INPUT_ID } from '@/shared/lib/focus'
import { IconButton } from '@/shared/ui/IconButton'
import styles from './Composer.module.css'

const MAX_HEIGHT_PX = 160
const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 300

/** Telegram's MessageInput: transition length grows with the log of the height change. */
const TRANSITION_DURATION_FACTOR = 50

/**
 * Grows the textarea with its content up to MAX_HEIGHT_PX, then it scrolls internally.
 * The height animates (CSS transition on `height`): measure the target with height:auto,
 * pin the old height, force a reflow, then set the target. Always measured from the current
 * value, so a deferred call after sending can never shrink a field the user already refilled.
 */
function autoResize(el: HTMLTextAreaElement) {
  const prev = el.offsetHeight
  el.style.transition = 'none'
  el.style.height = 'auto'
  const target = Math.min(el.scrollHeight, MAX_HEIGHT_PX)
  el.style.height = `${prev}px`
  void el.offsetHeight // reflow: commit the old height before transitioning
  el.style.transition = ''
  const delta = Math.abs(target - prev)
  el.style.transitionDuration =
    delta > 1 ? `${Math.round(TRANSITION_DURATION_FACTOR * Math.log(delta))}ms` : '0ms'
  el.style.height = `${target}px`
  el.classList.toggle(styles.overflown!, el.scrollHeight > MAX_HEIGHT_PX)
}

/** Filled paper plane, like Telegram's send button glyph. */
function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.4 20.4 20.85 12.92a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91Z" />
    </svg>
  )
}

interface ComposerProps {
  /** Returns false if the text was rejected (empty / too long). */
  onSend: (text: string) => boolean
  autoFocus?: boolean
}

export function Composer({ onSend, autoFocus = true }: ComposerProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const trimmedLength = text.trim().length
  const tooLong = text.length > MAX_MESSAGE_LENGTH
  const canSend = trimmedLength > 0 && !tooLong

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value)
    autoResize(event.target)
  }

  function submit() {
    if (!canSend) return
    if (onSend(text)) {
      setText('')
      const el = textareaRef.current
      if (el) {
        el.focus()
        // Shrink on the next frame, after React has cleared the value (as Telegram does).
        requestAnimationFrame(() => autoResize(el))
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline; ignore Enter while an IME composition is active.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className={clsx(styles.composer, tooLong && styles.invalid)} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor={COMPOSER_INPUT_ID} className="visually-hidden">
          Сообщение
        </label>
        <textarea
          id={COMPOSER_INPUT_ID}
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          placeholder="Сообщение"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          enterKeyHint="send"
          aria-describedby={text.length > COUNTER_THRESHOLD ? 'composer-counter' : undefined}
        />
        {text.length > COUNTER_THRESHOLD && (
          <span id="composer-counter" className={styles.counter} aria-live="polite">
            {MAX_MESSAGE_LENGTH - text.length}
          </span>
        )}
      </div>
      <IconButton
        type="submit"
        label="Отправить"
        variant="accent"
        className={styles.send}
        disabled={!canSend}
      >
        {/* key: the glyph remounts and "grows" every time the button becomes active. */}
        <span key={canSend ? 'ready' : 'idle'} className={styles.sendIcon}>
          <SendIcon />
        </span>
      </IconButton>
    </form>
  )
}
