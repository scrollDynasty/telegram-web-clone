import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { GreenApiClient, type GreenApiCredentials } from './greenApi'

const GreenApiClientContext = createContext<GreenApiClient | null>(null)

export function GreenApiClientProvider({
  credentials,
  children,
}: {
  credentials: GreenApiCredentials
  children: ReactNode
}) {
  const { apiUrl, idInstance, apiTokenInstance } = credentials
  const client = useMemo(
    () => new GreenApiClient({ apiUrl, idInstance, apiTokenInstance }),
    [apiUrl, idInstance, apiTokenInstance],
  )
  return <GreenApiClientContext.Provider value={client}>{children}</GreenApiClientContext.Provider>
}

export function useGreenApiClient(): GreenApiClient {
  const client = useContext(GreenApiClientContext)
  if (!client) throw new Error('useGreenApiClient must be used inside <GreenApiClientProvider>')
  return client
}
