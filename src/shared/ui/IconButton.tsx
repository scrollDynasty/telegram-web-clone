import clsx from 'clsx'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import styles from './IconButton.module.css'
import { Ripple } from './Ripple'

interface IconButtonProps extends ComponentPropsWithRef<'button'> {
  /** Accessible name; also used as the tooltip. */
  label: string
  children: ReactNode
  variant?: 'ghost' | 'accent'
  size?: 'md' | 'lg'
}

export function IconButton({
  label,
  children,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(styles.button, styles[variant], styles[size], className)}
      {...rest}
    >
      {children}
      <Ripple centered />
    </button>
  )
}
