import { useEffect } from 'react'
import { useThemeStore } from '@/entities/theme/store'
import { applyThemeToDocument } from './switchTheme'

/**
 * Mirrors the stored preference onto <html data-theme> on startup and on every change.
 * The first paint is already themed by the inline script in index.html; animated switches
 * apply the theme themselves (switchTheme), so this is a no-op for them.
 */
export function useApplyTheme() {
  const preference = useThemeStore((s) => s.preference)

  useEffect(() => {
    applyThemeToDocument(preference)
  }, [preference])
}
