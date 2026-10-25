import { Navigate, Route, Routes } from 'react-router-dom'
import { BarChart3, Bell, BookOpen, Boxes, CreditCard, FileText, Headphones, HelpCircle, LayoutDashboard, MapPin, ScrollText, Settings, Tag, Truck, UserCog, Users, Wrench } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import AdminDashboard from './AdminDashboard'
import { AdminBookingDetail, AdminBookingsList } from './AdminBookings'
import { CustomersPage, DriversPage, VehiclesPage } from './AdminPeople'
import { AreasPage, ConfigPage, ContentPage, FaqsPage, InventoryItemsPage, PricingPage, ServicesPage } from './AdminCatalog'
import { AdminAudit, AdminPayments, AdminReports, AdminSupport } from './AdminOps'
import NotificationsPage from '../notifications/NotificationsPage'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, section: 'Operations' },
  { to: '/admin/bookings', label: 'Bookings', icon: Truck },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/support', label: 'Support & reviews', icon: Headphones },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/customers', label: 'Customers', icon: Users, section: 'People' },
  { to: '/admin/drivers', label: 'Drivers', icon: UserCog },
  { to: '/admin/vehicles', label: 'Vehicles', icon: Wrench },
  { to: '/admin/pricing', label: 'Pricing rules', icon: Tag, section: 'Catalogue' },
  { to: '/admin/services', label: 'Services', icon: Boxes },
  { to: '/admin/areas', label: 'Service areas', icon: MapPin },
  { to: '/admin/inventory', label: 'Inventory items', icon: BookOpen },
  { to: '/admin/faqs', label: 'FAQs', icon: HelpCircle, section: 'Website' },
  { to: '/admin/content', label: 'Pages & policies', icon: FileText },
  { to: '/admin/config', label: 'Business settings', icon: Settings },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3, section: 'Insights' },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
]

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<DashboardLayout items={NAV} roleLabel="Admin" />}>
        <Route index element={<AdminDashboard />} />
        <Route path="bookings" element={<AdminBookingsList />} />
        <Route path="bookings/:id" element={<AdminBookingDetail />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="support" element={<AdminSupport />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="areas" element={<AreasPage />} />
        <Route path="inventory" element={<InventoryItemsPage />} />
        <Route path="faqs" element={<FaqsPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
