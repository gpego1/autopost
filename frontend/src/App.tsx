import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { queryClient } from '@/lib/queryClient'
import { Accounts } from '@/pages/Accounts'
import { Calendar } from '@/pages/Calendar'
import { Composer } from '@/pages/Composer'
import { Dashboard } from '@/pages/Dashboard'
import { History } from '@/pages/History'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/composer" element={<Composer />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/history" element={<History />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
