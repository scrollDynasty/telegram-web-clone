import { animationFor, glyphOf } from './statusAnimation'

describe('status icon animation', () => {
  it('maps statuses to Telegram glyphs (delivered is still one tick)', () => {
    expect(
      ['pending', 'sent', 'delivered', 'read', 'failed'].map((s) => glyphOf(s as never)),
    ).toEqual(['clock', 'tick', 'tick', 'double', 'failed'])
  })

  it.each([
    ['clock', 'tick', null, 'first'],
    ['clock', 'double', null, 'first'],
    ['failed', 'tick', null, 'first'],
    ['tick', 'double', null, 'second'],
    // Read arrived while the first tick was still being drawn: it keeps drawing.
    ['tick', 'double', 'first', 'first+second'],
    ['double', 'failed', null, null],
    ['tick', 'clock', null, null],
  ] as const)('%s → %s (previous %s) → %s', (from, to, previous, expected) => {
    expect(animationFor(from, to, previous)).toBe(expected)
  })
})
