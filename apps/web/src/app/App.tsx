import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '../features/auth/AuthProvider'
import { createQueryClient } from '../lib/query-client'
import { ServerStatusNotice } from '../shared/ui/ServerStatusNotice'
import { ToastProvider } from '../shared/ui/Toast'
import { router } from './router'

export function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <ServerStatusNotice />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
