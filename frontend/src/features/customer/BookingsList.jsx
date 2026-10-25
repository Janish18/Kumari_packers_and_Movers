import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PackagePlus, Truck } from 'lucide-react'
import { bookingApi } from '../../api/bookingApi'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import DataTable, { Pagination, SearchBox } from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import { PageHeader } from '../../components/common/Layout'
import { EmptyState } from '../../components/common/Feedback'
import { Select } from '../../components/common/Field'
import { STATUS, date, money } from '../../utils/format'

export default function BookingsList() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const status = sp.get('status') || ''
  const search = useDebounce(q)
  const { data, loading, error, reload } = useApi(() => bookingApi.list({ page, search: search || undefined, status: status || undefined }), [page, search, status])
  const cols = [
    { key: 'reference', header: 'Reference', render: (b) => <span className="font-bold">{b.reference}</span> },
    { key: 'route', header: 'Route', render: (b) => <span>{b.pickup_city} → {b.drop_city}</span> },
    { key: 'move_date', header: 'Move date', render: (b) => date(b.move_date), hideOnMobile: true },
    { key: 'service_name', header: 'Service', hideOnMobile: true },
    { key: 'total', header: 'Total', render: (b) => <span className="tabular-nums">{money(b.total)}</span>, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status} /> },
  ]
  return (
    <div>
      <PageHeader title="My bookings" subtitle="Every move you've requested." actions={<Link to="/app/bookings/new" className="btn btn-primary btn-shine"><PackagePlus className="h-4 w-4" />New booking</Link>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search reference or city" />
        <Select aria-label="Filter by status" value={status} onChange={(e) => { setPage(1); const n = new URLSearchParams(sp); e.target.value ? n.set('status', e.target.value) : n.delete('status'); setSp(n) }}><option value="">All statuses</option>{Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</Select>
      </div>
      <DataTable columns={cols} rows={data?.results} loading={loading} error={error} onRetry={reload} onRowClick={(b) => nav(`/app/bookings/${b.id}`)}
        empty={<EmptyState icon={Truck} title={search || status ? 'No bookings match' : 'No bookings yet'} text={search || status ? 'Try clearing the filters.' : 'Request your first quotation in a few minutes.'} action={!search && !status && <Link to="/app/bookings/new" className="btn btn-primary">Create a booking</Link>} />} />
      {data && <Pagination page={page} count={data.count} onPage={setPage} />}
    </div>
  )
}
