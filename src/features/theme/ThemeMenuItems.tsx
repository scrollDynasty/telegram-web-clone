import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type ThemePreference } from '@/entities/theme/store'
import { MenuGroup, MenuItem } from '@/shared/ui/Menu'
import { originOf, switchTheme } from './switchTheme'

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'Как в системе', Icon: Monitor },
  { value: 'light', label: 'Светлая тема', Icon: Sun },
  { value: 'dark', label: 'Ночная тема', Icon: Moon },
]

/**
 * Theme switch as a radio group inside a menu (the header menu of the chat list).
 * The new theme is revealed by a circle growing from the chosen item.
 */
export function ThemeMenuItems() {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <MenuGroup label="Тема">
      {OPTIONS.map(({ value, label, Icon }) => (
        <MenuItem
          key={value}
          icon={<Icon size={20} />}
          checked={preference === value}
          onSelect={(event) =>
            switchTheme(value, originOf(event.currentTarget), () => setPreference(value))
          }
        >
          {label}
        </MenuItem>
      ))}
    </MenuGroup>
  )
}
