import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useThemeStore } from '@/entities/theme/store'
import { applyThemeToDocument } from './switchTheme'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => {
  useThemeStore.setState({ preference: 'system' })
  applyThemeToDocument('system')
})

describe('ThemeToggle', () => {
  it('switches between light and night themes', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    // jsdom has no matchMedia, so the OS scheme reads as light.
    await user.click(screen.getByRole('button', { name: 'Включить ночную тему' }))
    expect(useThemeStore.getState().preference).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    await user.click(screen.getByRole('button', { name: 'Включить светлую тему' }))
    expect(useThemeStore.getState().preference).toBe('system')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(screen.getByRole('button', { name: 'Включить ночную тему' })).toBeInTheDocument()
  })
})
