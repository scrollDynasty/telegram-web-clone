import { applyThemeToDocument, nextPreference, resolveTheme, switchTheme } from './switchTheme'

afterEach(() => {
  applyThemeToDocument('system')
})

describe('nextPreference', () => {
  it('always flips the visible theme', () => {
    expect(nextPreference('system', 'dark')).toBe('light')
    expect(nextPreference('system', 'light')).toBe('dark')
    expect(nextPreference('dark', 'dark')).toBe('light')
  })

  it('goes back to following the OS when the target matches it', () => {
    expect(nextPreference('light', 'dark')).toBe('system')
    expect(nextPreference('dark', 'light')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('uses the OS scheme only for "system"', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('light', 'dark')).toBe('light')
  })
})

describe('switchTheme', () => {
  it('applies the theme synchronously when View Transitions are unavailable', () => {
    const commit = vi.fn<() => void>()
    switchTheme('dark', { x: 0, y: 0 }, commit)
    expect(commit).toHaveBeenCalledOnce()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).not.toHaveAttribute('data-theme-switching')
  })

  it('removes the attribute for "system"', () => {
    applyThemeToDocument('light')
    switchTheme('system', { x: 0, y: 0 }, () => {})
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('updates <meta name="theme-color"> and restores it for "system"', () => {
    const light = document.createElement('meta')
    light.name = 'theme-color'
    light.media = '(prefers-color-scheme: light)'
    const dark = document.createElement('meta')
    dark.name = 'theme-color'
    dark.media = '(prefers-color-scheme: dark)'
    document.head.append(light, dark)

    applyThemeToDocument('dark')
    expect([light.content, dark.content]).toEqual(['#212121', '#212121'])
    applyThemeToDocument('system')
    expect([light.content, dark.content]).toEqual(['#ffffff', '#212121'])

    light.remove()
    dark.remove()
  })
})
