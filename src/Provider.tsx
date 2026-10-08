import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect } from 'react'
import { Toaster } from 'sonner'
import { setupQueryFocusEvents } from '@/services/query-focus-manager'

focusManager.setEventListener((onFocus) => setupQueryFocusEvents(onFocus))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
})

export function broadcastTabSync() {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const channel = new BroadcastChannel('vg_admin_tab_sync')
    channel.postMessage('invalidate')
    channel.close()
  }
}

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('vg_admin_tab_sync') : null

    if (channel) {
      channel.onmessage = (event) => {
        if (event.data === 'invalidate') {
          queryClient.invalidateQueries()
        }
      }
    }

    return () => {
      if (channel) channel.close()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
