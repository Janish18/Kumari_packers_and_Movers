import { Navigate, Route, Routes } from 'react-router-dom'
import DriverLayout from '../../components/layout/DriverLayout'
import NotificationsPage from '../notifications/NotificationsPage'
import { DriverHome, DriverJobDetail, DriverJobs, DriverProfile } from './DriverPages'

export default function DriverApp() {
  return (
    <Routes>
      <Route element={<DriverLayout />}>
        <Route index element={<DriverHome />} />
        <Route path="jobs" element={<DriverJobs />} />
        <Route path="jobs/:id" element={<DriverJobDetail />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<DriverProfile />} />
        <Route path="*" element={<Navigate to="/driver" replace />} />
      </Route>
    </Routes>
  )
}
