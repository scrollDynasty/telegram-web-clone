import { ChatStoreProvider } from '@/entities/chat/context'
import { useSessionStore } from '@/entities/session/store'
import { useApplyTheme } from '@/features/theme/useApplyTheme'
import { LoginPage } from '@/pages/LoginPage'
import { MessengerPage } from '@/pages/MessengerPage'
import { GreenApiClientProvider } from '@/shared/api/client-context'

export function App() {
  useApplyTheme()
  const credentials = useSessionStore((s) => s.credentials)

  if (!credentials) return <LoginPage />

  return (
    <GreenApiClientProvider credentials={credentials}>
      {/* key: a different instance gets its own history and a fresh store. */}
      <ChatStoreProvider key={credentials.idInstance} instanceId={credentials.idInstance}>
        <MessengerPage />
      </ChatStoreProvider>
    </GreenApiClientProvider>
  )
}
