import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PublicLayout from '../components/layout/PublicLayout'
import AuthLayout from '../components/layout/AuthLayout'
import HomePage from '../features/public/HomePage'
import { ContactPage, LegalPage, NotFoundPage, QuotePage, ServicesPage, TrackPage } from '../features/public/PublicPages'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import { ForgotPasswordPage, ResetPasswordPage } from '../features/auth/RecoveryPages'
import { GuestOnly, RequireRole } from '../features/auth/AuthContext'
import { Spinner } from '../components/common/Feedback'

const CustomerApp = lazy(() => import('../features/customer/CustomerApp'))
const AdminApp = lazy(() => import('../features/admin/AdminApp'))
const DriverApp = lazy(() => import('../features/driver/DriverApp'))

const Loading = () => <div className="grid min-h-[60vh] place-items-center"><Spinner className="h-8 w-8" /></div>

export default function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="quote" element={<QuotePage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="track" element={<TrackPage />} />
          <Route path="privacy" element={<LegalPage slug="privacy" />} />
          <Route path="terms" element={<LegalPage slug="terms" />} />
          <Route path="refund-policy" element={<LegalPage slug="refund-policy" />} />
          <Route path="cancellation-policy" element={<LegalPage slug="cancellation-policy" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>
        <Route path="app/*" element={<RequireRole roles={['CUSTOMER']}><CustomerApp /></RequireRole>} />
        <Route path="admin/*" element={<RequireRole roles={['ADMIN']}><AdminApp /></RequireRole>} />
        <Route path="driver/*" element={<RequireRole roles={['DRIVER']}><DriverApp /></RequireRole>} />
        <Route path="dashboard" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
