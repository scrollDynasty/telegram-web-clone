import clsx from 'clsx'
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import styles from './TextField.module.css'

interface TextFieldProps extends ComponentPropsWithRef<'input'> {
  label: string
  hint?: ReactNode
  error?: string
  /** Element rendered inside the field on the right (e.g. "show password"). */
  trailing?: ReactNode
}

/**
 * Outlined input with a label that rises onto the border (Telegram Web's .input-group).
 * As in Telegram, a validation error replaces the label text; the field keeps its accessible
 * name and the error is announced through a visually hidden alert.
 */
export function TextField({
  label,
  hint,
  error,
  trailing,
  className,
  id,
  ...rest
}: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={clsx(styles.field, error && styles.invalid, className)}>
      <div className={clsx(styles.control, trailing != null && styles.withTrailing)}>
        <input
          id={inputId}
          className={styles.input}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <label htmlFor={inputId} className={styles.label} title={error}>
          {error ? (
            <>
              <span className="visually-hidden">{label}</span>
              <span aria-hidden="true">{error}</span>
            </>
          ) : (
            label
          )}
        </label>
        {trailing != null && <div className={styles.trailing}>{trailing}</div>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="visually-hidden" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}
