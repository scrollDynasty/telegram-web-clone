import { rememberAwareStorage, useSessionStore } from './store'

const KEY = 'gac:session'
const credentials = { apiUrl: 'https://api.test', idInstance: '4100000001', apiTokenInstance: 'x' }
const snapshot = (remember: boolean) => JSON.stringify({ state: { remember }, version: 1 })

describe('session storage', () => {
  afterEach(() => {
    sessionStorage.clear()
    useSessionStore.setState({ credentials: null, account: null, logoutReason: null })
  })

  it('"remember" keeps the session in localStorage only', () => {
    sessionStorage.setItem(KEY, 'stale')
    rememberAwareStorage.setItem(KEY, snapshot(true))
    expect(localStorage.getItem(KEY)).toBe(snapshot(true))
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('unticking "remember" moves the session out of localStorage', () => {
    rememberAwareStorage.setItem(KEY, snapshot(true))
    rememberAwareStorage.setItem(KEY, snapshot(false))
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBe(snapshot(false))
    expect(rememberAwareStorage.getItem(KEY)).toBe(snapshot(false))
  })

  it('logs in without "remember" into sessionStorage, and a logout keeps no credentials', () => {
    useSessionStore.getState().login(credentials, { stateInstance: 'authorized' }, false)
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(sessionStorage.getItem(KEY)).toContain('4100000001')

    useSessionStore.getState().logout()
    expect(sessionStorage.getItem(KEY)).not.toContain('4100000001')
  })

  it('keeps the reason of a forced logout in memory until the next login', () => {
    useSessionStore.getState().login(credentials, { stateInstance: 'authorized' }, true)
    useSessionStore.getState().logout('Токен отозван')
    expect(useSessionStore.getState().logoutReason).toBe('Токен отозван')
    expect(localStorage.getItem(KEY)).not.toContain('Токен отозван')

    useSessionStore.getState().login(credentials, { stateInstance: 'authorized' }, true)
    expect(useSessionStore.getState().logoutReason).toBeNull()
  })
})
