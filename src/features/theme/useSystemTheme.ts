import { useSyncExternalStore } from 'react'
import { subscribeSystemTheme, systemTheme, type ResolvedTheme } from './switchTheme'

/** The OS colour scheme, kept live via matchMedia. */
export function useSystemTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeSystemTheme, systemTheme, () => 'light')
}
