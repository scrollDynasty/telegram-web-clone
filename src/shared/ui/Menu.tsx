import clsx from 'clsx'
import { Check } from 'lucide-react'
import {
  createContext,
  use,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { usePresence } from '@/shared/lib/usePresence'
import { IconButton } from './IconButton'
import styles from './Menu.module.css'
import { Ripple } from './Ripple'

const CloseMenuContext = createContext<() => void>(() => {})

const ITEM_SELECTOR = '[role^="menuitem"]:not([aria-disabled="true"])'
/** Closing animation length (Telegram's `.bubble.closing`: 0.2s ease-in) plus a safety margin. */
const CLOSE_TIMEOUT_MS = 250

interface MenuProps {
  /** Accessible name of the trigger button. */
  label: string
  /** Content of the round trigger button. */
  icon: ReactNode
  /** Accessible name of the popup (defaults to `label`). */
  menuLabel?: string
  className?: string
  children: ReactNode
}

/**
 * Menu button with a compact dropdown (Telegram's `.Menu.compact`).
 * WAI-ARIA menu pattern: arrows/Home/End move focus, Esc and outside clicks close it.
 */
export function Menu({ label, icon, menuLabel, className, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  // The popup stays mounted while its closing animation plays.
  const presence = usePresence(open, CLOSE_TIMEOUT_MS)

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    // Focus the first item so the keyboard lands inside the menu.
    listRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus()

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next: HTMLElement | undefined
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      case 'Tab':
        close(false)
        return
      case 'ArrowDown':
        next = items[(index + 1) % items.length]
        break
      case 'ArrowUp':
        next = items[(index - 1 + items.length) % items.length]
        break
      case 'Home':
        next = items[0]
        break
      case 'End':
        next = items.at(-1)
        break
      default:
        return
    }
    event.preventDefault()
    next?.focus()
  }

  return (
    <div ref={rootRef} className={clsx(styles.root, className)}>
      <IconButton
        ref={triggerRef}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={clsx(open && styles.triggerOpen)}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
      </IconButton>
      {presence.mounted && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={menuLabel ?? label}
          className={styles.menu}
          data-state={open ? 'open' : 'closed'}
          inert={!open}
          onKeyDown={handleKeyDown}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget && !open) presence.done()
          }}
          tabIndex={-1}
        >
          <CloseMenuContext value={() => close()}>{children}</CloseMenuContext>
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  icon?: ReactNode
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void
  /** Renders a menuitemradio with a check mark. */
  checked?: boolean
  danger?: boolean
  /** Secondary line under the label. */
  description?: ReactNode
  title?: string
  children: ReactNode
}

export function MenuItem({
  icon,
  onSelect,
  checked,
  danger,
  description,
  title,
  children,
}: MenuItemProps) {
  const closeMenu = use(CloseMenuContext)
  const isRadio = checked !== undefined
  return (
    <button
      type="button"
      role={isRadio ? 'menuitemradio' : 'menuitem'}
      aria-checked={isRadio ? checked : undefined}
      tabIndex={-1}
      title={title}
      className={clsx(styles.item, danger && styles.danger, description != null && styles.twoLine)}
      onClick={(event) => {
        onSelect(event)
        closeMenu()
      }}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>
        <span className={styles.text}>{children}</span>
        {description != null && <span className={styles.description}>{description}</span>}
      </span>
      {checked && <Check size={18} className={styles.check} aria-hidden="true" />}
      <Ripple />
    </button>
  )
}

export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      {children}
    </div>
  )
}

export function MenuSeparator() {
  return <hr className={styles.separator} />
}
