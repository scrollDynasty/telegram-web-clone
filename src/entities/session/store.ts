import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { GreenApiCredentials } from '@/shared/api/greenApi'
import type { AccountSettings } from '@/shared/api/schemas'

export interface Account {
  phone?: string
  username?: string
  avatar?: string
}

interface SessionState {
  credentials: GreenApiCredentials | null
  account: Account | null
  /** When false the session lives in sessionStorage and is gone once the tab is closed. */
  remember: boolean
  /** Why the session ended when it was not the user's choice (shown on the login screen). */
  logoutReason: string | null
  login: (credentials: GreenApiCredentials, account: AccountSettings, remember: boolean) => void
  logout: (reason?: string) => void
}

const STORAGE_KEY = 'gac:session'

/** Routes the persisted session to localStorage or sessionStorage depending on `remember`. */
export const rememberAwareStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name) ?? sessionStorage.getItem(name),
  setItem: (name, value) => {
    let remember = false
    try {
      remember = Boolean((JSON.parse(value) as { state?: { remember?: boolean } }).state?.remember)
    } catch {
      // Malformed value: fall back to the short-lived storage.
    }
    const [target, other] = remember
      ? [localStorage, sessionStorage]
      : [sessionStorage, localStorage]
    target.setItem(name, value)
    other.removeItem(name)
  },
  removeItem: (name) => {
    localStorage.removeItem(name)
    sessionStorage.removeItem(name)
  },
}

function toAccount(settings: AccountSettings): Account {
  return {
    phone: settings.phone || undefined,
    username: settings.username || undefined,
    avatar: settings.avatar || undefined,
  }
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      credentials: null,
      account: null,
      remember: true,
      logoutReason: null,
      login: (credentials, settings, remember) =>
        set({ credentials, account: toAccount(settings), remember, logoutReason: null }),
      logout: (reason) => set({ credentials: null, account: null, logoutReason: reason ?? null }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: ({ credentials, account, remember }) => ({ credentials, account, remember }),
    },
  ),
)
