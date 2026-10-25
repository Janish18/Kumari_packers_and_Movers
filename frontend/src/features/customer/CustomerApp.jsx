import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Bell, CreditCard, Headphones, LayoutDashboard, PackagePlus, Truck, UserCircle2 } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import CustomerDashboard from './CustomerDashboard'
import BookingsList from './BookingsList'
import BookingDetail from './BookingDetail'
import NewBooking from './NewBooking'
import { PaymentsPage, ProfilePage, SupportPage } from './CustomerMisc'
import NotificationsPage from '../notifications/NotificationsPage'

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/bookings/new', label: 'New booking', icon: PackagePlus, end: true },
  { to: '/app/bookings', label: 'My bookings', icon: Truck, end: true },
  { to: '/app/payments', label: 'Payments', icon: CreditCard },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/support', label: 'Support', icon: Headphones },
  { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
]

export default function CustomerApp() {
  return (
    <Routes>
      <Route element={<DashboardLayout items={NAV} roleLabel="Customer" />}>
        <Route index element={<CustomerDashboard />} />
        <Route path="bookings" element={<BookingsList />} />
        <Route path="bookings/new" element={<NewBooking />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="bookings/:id/edit" element={<NewBooking />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  )
}
