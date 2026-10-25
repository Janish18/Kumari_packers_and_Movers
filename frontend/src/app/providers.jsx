import { MotionConfig } from 'framer-motion'
import { Toaster } from 'sonner'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'

export default function Providers({ children }) {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  )
}
