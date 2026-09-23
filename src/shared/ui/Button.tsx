import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'
import { Ripple } from './Ripple'
import { Spinner } from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: filled; text: transparent accent text; danger: transparent red text. */
  variant?: 'primary' | 'text' | 'danger'
  loading?: boolean
  block?: boolean
  /** Compact mixed-case pill (40px, no uppercase). */
  pill?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  block = false,
  pill = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        styles.button,
        styles[variant],
        block && styles.block,
        pill && styles.pill,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size={20} />}
      <span className={styles.content}>{children}</span>
      <Ripple />
    </button>
  )
}
