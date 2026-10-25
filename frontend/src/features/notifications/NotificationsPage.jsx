import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, CheckCheck } from 'lucide-react'
import { bookingApi } from '../../api/bookingApi'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../auth/AuthContext'
import Button from '../../components/common/Button'
import { Pagination } from '../../components/common/DataTable'
import { EmptyState, ErrorState, SkeletonList } from '../../components/common/Feedback'
import { PageHeader, Tabs } from '../../components/common/Layout'
import { timeAgo } from '../../utils/format'

export default function NotificationsPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const { data, loading, error, reload } = useApi(() => bookingApi.notifications({ page, is_read: filter === 'unread' ? false : undefined }), [page, filter])
  const target = (n) => (user.role === 'ADMIN' ? `/admin/bookings/${n.booking}` : user.role === 'DRIVER' ? `/driver/jobs/${n.booking}` : `/app/bookings/${n.booking}`)
  const open = async (n) => { if (!n.is_read) await bookingApi.markRead(n.id).catch(() => {}); if (n.booking) nav(target(n)); else reload(true) }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" subtitle="Updates about your bookings, payments and support." actions={<Button variant="outline" size="sm" icon={CheckCheck} onClick={async () => { await bookingApi.markAllRead(); reload(true) }}>Mark all read</Button>} />
      <Tabs tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} value={filter} onChange={(v) => { setFilter(v); setPage(1) }} className="mb-5 w-fit" />
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <SkeletonList /> : !data.results.length ? <EmptyState icon={Bell} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} text="We'll let you know when something changes." /> : (
        <ul className="space-y-2">{data.results.map((n) => (
          <li key={n.id}><button onClick={() => open(n)} className={clsx('card card-hover flex w-full items-start gap-4 p-4 text-left', !n.is_read && 'border-brand-200 bg-brand-50/50 dark:bg-brand-500/5')}>
            <span className={clsx('mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full', n.is_read ? 'bg-navy-100 text-navy-400 dark:bg-navy-800' : 'bg-brand-500 text-white')}><Bell className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="font-semibold">{n.title}</p>{n.body && <p className="mt-0.5 text-sm text-navy-400">{n.body}</p>}<p className="mt-1 text-xs text-navy-300">{timeAgo(n.created_at)}{n.booking_reference ? ` · ${n.booking_reference}` : ''}</p></div>
          </button></li>))}</ul>)}
      {data && <Pagination page={page} count={data.count} onPage={setPage} />}
    </div>
  )
}
