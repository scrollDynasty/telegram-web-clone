import { render, screen } from '@testing-library/react'
import type { Message } from '@/entities/chat/model'
import { MessageList } from './MessageList'

const now = Date.now()
const message = (id: string, direction: Message['direction'], text: string): Message => ({
  id,
  direction,
  text,
  timestamp: now,
  status: 'read',
})

/** The bubble row is the closest element carrying an entry-animation class, if any. */
function isAnimated(text: string): boolean {
  const row = screen.getByText(text).closest('[class*="row"]')
  return /appear(In|Out)/.test(row?.className ?? '')
}

describe('MessageList', () => {
  it('animates only messages that arrive after mount', () => {
    const history = [
      message('1', 'in', 'первое'),
      message('2', 'out', 'второе'),
      message('3', 'in', 'третье'),
    ]
    const { rerender } = render(
      <MessageList messages={history} peerName="Алиса" onRetry={() => {}} />,
    )
    expect(['первое', 'второе', 'третье'].some(isAnimated)).toBe(false)

    rerender(
      <MessageList
        messages={[...history, message('4', 'out', 'новое')]}
        peerName="Алиса"
        onRetry={() => {}}
      />,
    )
    expect(isAnimated('новое')).toBe(true)
    expect(['первое', 'второе', 'третье'].some(isAnimated)).toBe(false)
  })

  it('puts every day into its own section, so date pills do not stack', () => {
    const yesterday: Message = { ...message('0', 'in', 'вчерашнее'), timestamp: now - 86_400_000 }
    const { container } = render(
      <MessageList
        messages={[yesterday, message('1', 'in', 'сегодняшнее')]}
        peerName="Алиса"
        onRetry={() => {}}
      />,
    )
    const sections = container.querySelectorAll('section')
    expect(sections).toHaveLength(2)
    expect(sections[0]).toHaveTextContent('вчерашнее')
    expect(sections[0]).not.toHaveTextContent('сегодняшнее')
  })

  it('names the author of each message for screen readers', () => {
    render(
      <MessageList
        messages={[message('1', 'in', 'привет'), message('2', 'out', 'пока')]}
        peerName="Алиса"
        onRetry={() => {}}
      />,
    )
    expect(screen.getByText('привет').closest('[class*="text"]')).toHaveTextContent(
      /^Алиса: привет/,
    )
    expect(screen.getByText('пока').closest('[class*="text"]')).toHaveTextContent(/^Вы: пока/)
  })

  it('keeps the jump button out of the tab order while hidden', () => {
    const { container } = render(
      <MessageList messages={[message('1', 'in', 'a')]} peerName="Алиса" onRetry={() => {}} />,
    )
    // Inert content is excluded from role queries, so look it up by its label directly.
    const jump = container.querySelector('button[aria-label="К последним сообщениям"]')
    expect(jump).toHaveAttribute('inert')
    expect(screen.queryByRole('button', { name: 'К последним сообщениям' })).toBeNull()
  })
})
