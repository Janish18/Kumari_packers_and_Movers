import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, PauseCircle } from 'lucide-react'
import { toast } from 'sonner'
import { CrudPage } from './AdminShared'
import { Badge } from '../../components/common/Feedback'
import { adminApi } from '../../api/adminApi'
import { date, errorMessage } from '../../utils/format'

const tone = { APPROVED: 'green', PENDING: 'amber', SUSPENDED: 'red' }
const avail = { AVAILABLE: 'green', BUSY: 'orange', OFF_DUTY: 'slate' }

export function CustomersPage() {
  const [sp] = useSearchParams()
  return <CrudPage title="Customers" subtitle="Customer accounts. Disable an account instead of deleting it to keep history." noun="customer" api={adminApi.customers} canCreate={false} canDelete={false} initialSearch={sp.get('search') || ''}
    columns={[{ key: 'full_name', header: 'Name', render: (r) => <b>{r.full_name}</b> }, { key: 'email', header: 'Email', hideOnMobile: true }, { key: 'phone', header: 'Phone' },
      { key: 'bookings_count', header: 'Bookings', className: 'tabular-nums' }, { key: 'is_active', header: 'Status', render: (r) => <Badge tone={r.is_active ? 'green' : 'red'}>{r.is_active ? 'Active' : 'Disabled'}</Badge> }, { key: 'created_at', header: 'Joined', hideOnMobile: true, render: (r) => date(r.created_at) }]}
    fields={[{ name: 'is_active', label: 'Account active', type: 'checkbox' }, { name: 'disabled_reason', label: 'Reason (shown to admins only)', hint: 'Fill when disabling an account.' }]} />
}

export function DriversPage() {
  const act = (fn, msg, reload) => async () => { try { await fn(); toast.success(msg); reload() } catch (e) { toast.error(errorMessage(e)) } }
  return <CrudPage title="Drivers" subtitle="Create driver accounts, approve them and assign vehicles. Only approved drivers can be dispatched." noun="driver" api={adminApi.drivers} canDelete={false}
    defaults={{ approval: 'PENDING', availability: 'OFF_DUTY', is_active: true }}
    rowActions={(r, reload) => r.approval !== 'APPROVED'
      ? <button aria-label={`Approve ${r.full_name}`} title="Approve" onClick={act(() => adminApi.drivers.approve(r.profile_id), 'Driver approved.', reload)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>
      : <button aria-label={`Suspend ${r.full_name}`} title="Suspend" onClick={act(() => adminApi.drivers.suspend(r.profile_id), 'Driver suspended.', reload)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><PauseCircle className="h-4 w-4" /></button>}
    columns={[{ key: 'full_name', header: 'Driver', render: (r) => <div><b>{r.full_name}</b><p className="text-xs text-navy-400">{r.phone}</p></div> },
      { key: 'license_number', header: 'Licence', hideOnMobile: true, render: (r) => <div>{r.license_number}<p className="text-xs text-navy-400">exp {date(r.license_expiry)}</p></div> },
      { key: 'vehicle', header: 'Vehicle', hideOnMobile: true, render: (r) => r.vehicle_detail?.registration_no || '-' },
      { key: 'approval', header: 'Approval', render: (r) => <Badge tone={tone[r.approval]}>{r.approval.toLowerCase()}</Badge> },
      { key: 'availability', header: 'Availability', render: (r) => <Badge tone={avail[r.availability]} dot>{r.availability.replace('_', ' ').toLowerCase()}</Badge> }]}
    fields={[{ name: 'full_name', label: 'Full name', required: true, half: true }, { name: 'phone', label: 'Phone', required: true, half: true }, { name: 'email', label: 'Email', type: 'email', required: true, half: true },
      { name: 'password', label: 'Temporary password', type: 'password', hint: 'Required for new drivers (min 8 chars). Leave blank when editing.', half: true },
      { name: 'license_number', label: 'Licence number', required: true, half: true }, { name: 'license_expiry', label: 'Licence expiry', type: 'date', required: true, half: true },
      { name: 'approval', label: 'Approval', type: 'select', options: ['PENDING', 'APPROVED', 'SUSPENDED'], half: true }, { name: 'is_active', label: 'Account active', type: 'checkbox' },
      { name: 'notes', label: 'Internal notes', type: 'textarea' }]}
    transform={(b) => { const { vehicle, ...rest } = b; return { ...rest, ...(vehicle ? { vehicle } : {}) } }} />
}

export function VehiclesPage() {
  return <CrudPage title="Vehicles" subtitle="Fleet used for dispatch." noun="vehicle" api={adminApi.vehicles} defaults={{ is_active: true, category: 'SMALL' }}
    columns={[{ key: 'registration_no', header: 'Registration', render: (r) => <b>{r.registration_no}</b> }, { key: 'category', header: 'Category' }, { key: 'capacity_cft', header: 'Capacity (cft)', className: 'tabular-nums' }, { key: 'is_active', header: 'Status', render: (r) => <Badge tone={r.is_active ? 'green' : 'slate'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> }]}
    fields={[{ name: 'registration_no', label: 'Registration number', required: true, half: true }, { name: 'category', label: 'Category', type: 'select', options: [{ value: 'MINI', label: 'Mini truck' }, { value: 'SMALL', label: 'Small truck' }, { value: 'MEDIUM', label: 'Medium truck' }, { value: 'LARGE', label: 'Large truck' }], required: true, half: true },
      { name: 'capacity_cft', label: 'Capacity (cubic ft)', type: 'number', half: true }, { name: 'is_active', label: 'Active', type: 'checkbox' }]} />
}
