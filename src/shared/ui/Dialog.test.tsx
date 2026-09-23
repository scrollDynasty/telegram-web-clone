import { act, fireEvent, render, screen } from '@testing-library/react'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps its content during the closing animation, then unmounts it', () => {
    vi.useFakeTimers()
    const { rerender, container } = render(
      <Dialog open onClose={() => {}} title="Новый чат">
        <p>содержимое</p>
      </Dialog>,
    )
    expect(screen.getByText('содержимое', { selector: 'p' })).toBeInTheDocument()

    rerender(
      <Dialog open={false} onClose={() => {}} title="Новый чат">
        <p>содержимое</p>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog')
    expect(dialog).toHaveAttribute('data-closing')
    expect(container).toHaveTextContent('содержимое')

    // jsdom never fires animationend: the timeout fallback finishes the close.
    act(() => vi.advanceTimersByTime(300))
    expect(dialog).not.toHaveAttribute('data-closing')
    expect(container).not.toHaveTextContent('содержимое')
  })

  it('closes through onClose on Escape keydown', () => {
    const onClose = vi.fn<() => void>()
    const { container } = render(
      <Dialog open onClose={onClose} title="Удалить чат?">
        <p>текст</p>
      </Dialog>,
    )
    fireEvent.keyDown(container.querySelector('dialog')!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('routes Esc (cancel) through onClose instead of closing natively', () => {
    const onClose = vi.fn<() => void>()
    const { container } = render(
      <Dialog open onClose={onClose} title="Удалить чат?">
        <p>текст</p>
      </Dialog>,
    )
    const cancel = new Event('cancel', { cancelable: true })
    container.querySelector('dialog')!.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('links the description for screen readers', () => {
    render(
      <Dialog open onClose={() => {}} title="Удалить чат?" description="История будет удалена">
        <p>текст</p>
      </Dialog>,
    )
    const dialog = document.querySelector('dialog')!
    const description = document.getElementById(dialog.getAttribute('aria-describedby')!)
    expect(description).toHaveTextContent('История будет удалена')
  })

  it('calls onClosed after the exit animation, once the dialog is closed', () => {
    vi.useFakeTimers()
    const onClosed = vi.fn<() => void>()
    const { rerender, container } = render(
      <Dialog open onClose={() => {}} onClosed={onClosed} title="Новый чат">
        <p>текст</p>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog')!
    // jsdom's <dialog> may lack showModal/close: emulate the open state the effect checks.
    if (!dialog.open) dialog.setAttribute('open', '')
    rerender(
      <Dialog open={false} onClose={() => {}} onClosed={onClosed} title="Новый чат">
        <p>текст</p>
      </Dialog>,
    )
    expect(onClosed).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(300))
    expect(onClosed).toHaveBeenCalledOnce()
  })
})
