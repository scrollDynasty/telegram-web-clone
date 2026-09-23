import type { Message } from '@/entities/chat/model'
import { buildListItems } from './listItems'

const base = new Date(2026, 8, 23, 12, 0).getTime()
const MIN = 60 * 1000

function msg(id: string, direction: 'in' | 'out', offsetMin: number): Message {
  return { id, direction, text: id, timestamp: base + offsetMin * MIN, status: 'sent' }
}

describe('buildListItems', () => {
  it('adds a day separator and clusters consecutive messages from the same side', () => {
    const items = buildListItems(
      [msg('a', 'in', 0), msg('b', 'in', 1), msg('c', 'out', 2), msg('d', 'out', 20)],
      base,
    )

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ label: 'Сегодня' })
    const flags = items[0]!.items.map((i) => [i.message.id, i.isFirst, i.isLast])
    expect(flags).toEqual([
      ['a', true, false],
      ['b', false, true],
      ['c', true, true],
      ['d', true, true],
    ])
  })

  it('starts a new day group after midnight, each holding its own messages', () => {
    const groups = buildListItems([msg('a', 'in', -24 * 60), msg('b', 'in', 0)], base)
    expect(groups.map((g) => g.label)).toEqual(['Вчера', 'Сегодня'])
    expect(groups.map((g) => g.items.map((i) => i.message.id))).toEqual([['a'], ['b']])
  })

  it('keys a day group by the calendar day, not by its first message', () => {
    const [before] = buildListItems([msg('b', 'in', 10)], base)
    const [after] = buildListItems([msg('a', 'in', 0), msg('b', 'in', 10)], base)
    expect(after!.key).toBe(before!.key)
  })

  it('uses the local id as a stable key for resolved optimistic messages', () => {
    const items = buildListItems([{ ...msg('srv', 'out', 0), localId: 'local-1' }], base)
    expect(items[0]!.items[0]!.key).toBe('local-1')
  })
})
