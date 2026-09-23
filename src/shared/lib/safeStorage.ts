import type { StateStorage } from 'zustand/middleware'

/**
 * Wraps a Web Storage so persistence failures never break the in-memory state.
 * zustand's persist calls setItem synchronously inside set(): a QuotaExceededError (large
 * history, small quota) or a SecurityError (storage disabled) would otherwise escape from
 * every store action after the state has already changed.
 */
export function safeStorage(getStorage: () => Storage): StateStorage {
  let warned = false
  const report = (error: unknown) => {
    if (warned) return
    warned = true
    console.warn('Persisting to storage failed; changes are kept in memory only', error)
  }
  return {
    getItem: (name) => {
      try {
        return getStorage().getItem(name)
      } catch (error) {
        report(error)
        return null
      }
    },
    setItem: (name, value) => {
      try {
        getStorage().setItem(name, value)
      } catch (error) {
        report(error)
      }
    },
    removeItem: (name) => {
      try {
        getStorage().removeItem(name)
      } catch (error) {
        report(error)
      }
    },
  }
}
