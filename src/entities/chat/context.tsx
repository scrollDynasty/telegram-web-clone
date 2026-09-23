import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createChatStore, syncWithOtherTabs, type ChatState, type ChatStore } from './store'

const ChatStoreContext = createContext<ChatStore | null>(null)

/**
 * History is scoped per GREEN-API instance, so the store is created per instance
 * (render with `key={idInstance}` to get a fresh store after switching accounts).
 */
export function ChatStoreProvider({
  instanceId,
  children,
}: {
  instanceId: string
  children: ReactNode
}) {
  const [store] = useState(() => createChatStore(instanceId))
  useEffect(() => syncWithOtherTabs(store, instanceId), [store, instanceId])
  return <ChatStoreContext.Provider value={store}>{children}</ChatStoreContext.Provider>
}

export function useChatStoreApi(): ChatStore {
  const store = useContext(ChatStoreContext)
  if (!store) throw new Error('useChatStoreApi must be used inside <ChatStoreProvider>')
  return store
}

export function useChatStore<T>(selector: (state: ChatState) => T): T {
  return useStore(useChatStoreApi(), selector)
}
