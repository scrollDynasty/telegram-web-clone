/** Up to two uppercase initials from a name; falls back to the last digits of a phone. */
export function initials(name: string): string {
  const words = name
    .replace(/^[@+]/, '')
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
  if (words.length === 0) return name.replace(/\D/g, '').slice(-2) || '?'
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
