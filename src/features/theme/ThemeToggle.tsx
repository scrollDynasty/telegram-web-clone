import clsx from 'clsx'
import { Moon, Sun } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { useThemeStore } from '@/entities/theme/store'
import { IconButton } from '@/shared/ui/IconButton'
import { nextPreference, originOf, resolveTheme, switchTheme } from './switchTheme'
import styles from './ThemeToggle.module.css'
import { useSystemTheme } from './useSystemTheme'

/** Light ↔ night switch; the icon shows the action (moon in light theme, sun in night theme). */
export function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)
  const system = useSystemTheme()
  const resolved = resolveTheme(preference, system)
  // The icon swap animates only after a click, not on mount.
  const [interacted, setInteracted] = useState(false)

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const next = nextPreference(preference, system)
    // Both updates land in the same commit, inside the view transition's `new` snapshot.
    switchTheme(next, originOf(event.currentTarget), () => {
      setInteracted(true)
      setPreference(next)
    })
  }

  const iconClass = (visible: boolean) =>
    clsx(styles.icon, visible ? styles.iconIn : styles.iconOut, !interacted && styles.still)

  return (
    <IconButton
      label={resolved === 'dark' ? 'Включить светлую тему' : 'Включить ночную тему'}
      onClick={handleClick}
    >
      <span className={styles.icons} aria-hidden="true">
        <Moon key="moon" size={24} className={iconClass(resolved === 'light')} />
        <Sun key="sun" size={24} className={iconClass(resolved === 'dark')} />
      </span>
    </IconButton>
  )
}
