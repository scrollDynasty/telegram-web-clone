import { fireEvent, render, screen } from '@testing-library/react'
import { IconButton } from './IconButton'

describe('Ripple', () => {
  it('adds a wave on primary-button press and ignores other buttons', () => {
    render(<IconButton label="Меню">≡</IconButton>)
    const button = screen.getByRole('button', { name: 'Меню' })
    const waves = () => button.querySelectorAll('[aria-hidden="true"] > span').length

    fireEvent.pointerDown(button, { button: 2 })
    expect(waves()).toBe(0)

    fireEvent.pointerDown(button, { button: 0 })
    expect(waves()).toBe(1)
  })

  it('does not ripple on a disabled button', () => {
    render(
      <IconButton label="Отправить" disabled>
        →
      </IconButton>,
    )
    const button = screen.getByRole('button', { name: 'Отправить' })
    fireEvent.pointerDown(button, { button: 0 })
    expect(button.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(0)
  })

  it('draws nothing under prefers-reduced-motion (no waves left behind)', () => {
    const matchMedia = vi.fn<(query: string) => { matches: boolean }>((query) => ({
      matches: query.includes('reduce'),
    }))
    vi.stubGlobal('matchMedia', matchMedia)
    try {
      render(<IconButton label="Меню">≡</IconButton>)
      const button = screen.getByRole('button', { name: 'Меню' })
      fireEvent.pointerDown(button, { button: 0 })
      expect(button.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(0)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('removes a wave even if animationend never fires', () => {
    vi.useFakeTimers()
    try {
      render(<IconButton label="Меню">≡</IconButton>)
      const button = screen.getByRole('button', { name: 'Меню' })
      fireEvent.pointerDown(button, { button: 0 })
      expect(button.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(1)
      vi.advanceTimersByTime(1_000)
      expect(button.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
