import { formatPhone, parsePhone, parseRecipient } from './phone'

describe('parsePhone', () => {
  it.each([
    ['+7 (987) 654-32-10', '79876543210'],
    ['8 987 654 32 10', '79876543210'],
    ['79876543210', '79876543210'],
    ['+44 20 7946 0958', '442079460958'],
  ])('normalizes %s → %s', (input, expected) => {
    expect(parsePhone(input)).toEqual({ ok: true, phone: expected })
  })

  it.each(['', '   ', '12345', '1234567890123456'])('rejects %j', (input) => {
    expect(parsePhone(input).ok).toBe(false)
  })
})

describe('parseRecipient', () => {
  it('detects usernames with or without @', () => {
    expect(parseRecipient('@durov_bot')).toEqual({
      ok: true,
      kind: 'username',
      username: '@durov_bot',
    })
    expect(parseRecipient('durov_bot')).toEqual({
      ok: true,
      kind: 'username',
      username: '@durov_bot',
    })
  })

  it('rejects too short usernames', () => {
    expect(parseRecipient('@abc').ok).toBe(false)
  })

  it('falls back to phone parsing', () => {
    expect(parseRecipient('+7 987 654 32 10')).toEqual({
      ok: true,
      kind: 'phone',
      phone: '79876543210',
    })
  })
})

describe('formatPhone', () => {
  it('formats RU numbers', () => {
    expect(formatPhone('79876543210')).toBe('+7 987 654-32-10')
  })

  it('prefixes other numbers with +', () => {
    expect(formatPhone('442079460958')).toBe('+442079460958')
  })
})
