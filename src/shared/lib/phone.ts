const MIN_DIGITS = 10
const MAX_DIGITS = 15

export type PhoneParseResult = { ok: true; phone: string } | { ok: false; error: string }

/**
 * Normalizes user input to international digits-only format (E.164 without "+").
 * A leading Russian trunk prefix "8" on an 11-digit number is converted to "7".
 */
export function parsePhone(input: string): PhoneParseResult {
  let digits = input.replace(/\D/g, '')
  if (!digits) return { ok: false, error: 'Введите номер телефона' }

  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
    return { ok: false, error: 'Номер должен содержать от 10 до 15 цифр с кодом страны' }
  }
  return { ok: true, phone: digits }
}

export type RecipientParseResult =
  | { ok: true; kind: 'phone'; phone: string }
  | { ok: true; kind: 'username'; username: string }
  | { ok: false; error: string }

// Telegram usernames: 5–32 chars, latin letters, digits and underscores.
const USERNAME_RE = /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/

/** Accepts a phone number or a Telegram @username. */
export function parseRecipient(input: string): RecipientParseResult {
  const value = input.trim()
  if (value.startsWith('@') || /^[a-zA-Z]/.test(value)) {
    if (!USERNAME_RE.test(value)) {
      return { ok: false, error: 'Юзернейм: 5–32 символа, латиница, цифры и «_»' }
    }
    return { ok: true, kind: 'username', username: value.startsWith('@') ? value : `@${value}` }
  }
  const phone = parsePhone(value)
  return phone.ok ? { ok: true, kind: 'phone', phone: phone.phone } : phone
}

/** Formats digits as "+7 987 654-32-10" for RU/KZ numbers, "+<digits>" otherwise. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('7')) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`
  }
  return d ? `+${d}` : ''
}
