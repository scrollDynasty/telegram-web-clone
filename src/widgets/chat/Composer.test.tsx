import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from './Composer'

function setup(onSend = vi.fn<(text: string) => boolean>(() => true)) {
  render(<Composer onSend={onSend} />)
  return { onSend, input: screen.getByLabelText('Сообщение'), user: userEvent.setup() }
}

describe('Composer', () => {
  it('sends on Enter and clears the field', async () => {
    const { onSend, input, user } = setup()
    await user.type(input, 'Привет{Enter}')
    expect(onSend).toHaveBeenCalledWith('Привет')
    expect(input).toHaveValue('')
  })

  it('inserts a newline on Shift+Enter', async () => {
    const { onSend, input, user } = setup()
    await user.type(input, 'a{Shift>}{Enter}{/Shift}b')
    expect(onSend).not.toHaveBeenCalled()
    expect(input).toHaveValue('a\nb')
  })

  it('does not send whitespace-only messages', async () => {
    const { onSend, input, user } = setup()
    await user.type(input, '   {Enter}')
    expect(onSend).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
  })

  it('keeps the text if sending was rejected', async () => {
    const { input, user } = setup(vi.fn<(text: string) => boolean>(() => false))
    await user.type(input, 'draft{Enter}')
    expect(input).toHaveValue('draft')
  })
})
