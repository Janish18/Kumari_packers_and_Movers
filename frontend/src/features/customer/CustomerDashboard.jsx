import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Bell, CalendarClock, CreditCard, FileText, Headphones, PackagePlus, Route, Truck, Wallet } from 'lucide-react'
import { bookingApi } from '../../api/bookingApi'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../auth/AuthContext'
import { AnimatedCounter, Stagger, StaggerItem } from '../../components/animations/Motion'
import { EmptyState, ErrorState, Skeleton } from '../../components/common/Feedback'
import StatusBadge from '../../components/common/StatusBadge'
import { PageHeader, Section } from '../../components/common/Layout'
import { date, money } from '../../utils/format'

function Stat({ icon: Icon, label, value, format, tone = 'brand', to }) {
  const c = { brand: 'bg-brand-500/10 text-brand-600', navy: 'bg-navy-900/10 text-navy-700 dark:text-navy-100', green: 'bg-emerald-500/10 text-emerald-600', amber: 'bg-amber-500/10 text-amber-600' }[tone]
  const body = (<><span className={`grid h-11 w-11 place-items-center rounded-xl ${c}`}><Icon className="h-5 w-5" /></span><p className="mt-4 font-display text-3xl font-extrabold"><AnimatedCounter value={value} format={format} /></p><p className="text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</p></>)
  return <StaggerItem>{to ? <Link to={to} className="card card-hover block p-5">{body}</Link> : <div className="card p-5">{body}</div>}</StaggerItem>
}

export default function CustomerDashboard() {
  const { user } = useAuth()
  const { data: d, loading, error, reload } = useApi(bookingApi.dashboard)
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <div>
      <PageHeader title={`Welcome, ${user.full_name.split(' ')[0]} 👋`} subtitle="Here's where your moves stand." actions={<Link to="/app/bookings/new" className="btn btn-primary btn-shine"><PackagePlus className="h-4 w-4" />New booking</Link>} />
      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div> : (<>
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Truck} label="Active bookings" value={d.counts.active} to="/app/bookings" />
          <Stat icon={FileText} label="Quotes awaiting you" value={d.counts.awaiting_quote_acceptance} tone="amber" to="/app/bookings?status=QUOTE_PREPARED" />
          <Stat icon={Wallet} label="Paid so far" value={d.payments.paid} format={(v) => money(v, true)} tone="green" to="/app/payments" />
          <Stat icon={CreditCard} label="Balance due" value={d.payments.due} format={(v) => money(v, true)} tone="navy" to="/app/payments" />
        </Stagger>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <Section title="Upcoming move">
              {d.upcoming_move ? (
                <Link to={`/app/bookings/${d.upcoming_move.id}`} className="noise group relative block overflow-hidden rounded-2xl bg-navy-900 p-6 text-white">
                  <div aria-hidden className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-brand-500/30 blur-3xl transition-all group-hover:scale-125" />
                  <div className="relative flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-300">{d.upcoming_move.reference}</p><p className="mt-1 font-display text-2xl font-extrabold">{date(d.upcoming_move.move_date, { weekday: 'short', day: '2-digit', month: 'long' })}</p></div><StatusBadge status={d.upcoming_move.status} /></div>
                  <div className="relative mt-6 flex items-center gap-3 text-sm"><span className="font-semibold">{d.upcoming_move.pickup_city}</span><span className="relative h-0.5 flex-1 bg-white/20"><motion.span className="absolute -top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-brand-500" animate={{ left: ['0%', '95%'] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} /></span><span className="font-semibold">{d.upcoming_move.drop_city}</span></div>
                  <p className="relative mt-5 flex items-center gap-1 text-sm font-semibold text-brand-300">Open booking <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></p>
                </Link>
              ) : <EmptyState icon={CalendarClock} title="No upcoming move" text="Start a booking to get an itemised quotation." action={<Link to="/app/bookings/new" className="btn btn-primary">Plan a move</Link>} />}
            </Section>
            {d.active_booking && <Section title="Live job"><Link to={`/app/bookings/${d.active_booking.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 transition hover:shadow-soft dark:bg-brand-500/10"><div className="flex items-center gap-3"><span className="relative grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-white"><span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/50" /><Route className="relative h-5 w-5" /></span><div><p className="font-bold">{d.active_booking.reference}</p><p className="text-xs text-navy-400">{d.active_booking.pickup_city} → {d.active_booking.drop_city}</p></div></div><StatusBadge status={d.active_booking.status} /></Link></Section>}
            <Section title="Recent quotations" action={<Link to="/app/bookings" className="text-sm font-semibold text-brand-600">All bookings</Link>}>
              {!d.recent_quotations.length ? <p className="text-sm text-navy-400">No quotations yet. They appear here after our team prices your request.</p> : (
                <ul className="divide-y divide-navy-100 dark:divide-navy-800">{d.recent_quotations.map((q) => <li key={q.id}><Link to={`/app/bookings/${q.booking}`} className="flex items-center justify-between gap-3 py-3 transition hover:text-brand-600"><div><p className="font-semibold">{q.booking_reference} · v{q.version}</p><p className="text-xs text-navy-400">Valid until {date(q.valid_until)}</p></div><div className="text-right"><p className="font-bold tabular-nums">{money(q.total)}</p><p className="text-xs capitalize text-navy-400">{q.status.toLowerCase()}</p></div></Link></li>)}</ul>)}
            </Section>
          </div>
          <div className="space-y-6">
            <Section title="Quick actions"><div className="grid grid-cols-2 gap-3">{[[PackagePlus, 'New booking', '/app/bookings/new'], [Truck, 'My bookings', '/app/bookings'], [CreditCard, 'Payments', '/app/payments'], [Headphones, 'Get support', '/app/support']].map(([Icon, l, to]) => <Link key={l} to={to} className="group flex flex-col items-center gap-2 rounded-xl border border-navy-100 p-4 text-center text-sm font-semibold transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-soft dark:border-navy-800"><Icon className="h-6 w-6 text-brand-500 transition-transform group-hover:scale-110" />{l}</Link>)}</div></Section>
            <Section title="Notifications"><Link to="/app/notifications" className="flex items-center justify-between rounded-xl bg-navy-50 p-4 dark:bg-navy-800"><span className="flex items-center gap-3"><Bell className="h-5 w-5 text-brand-500" /><span className="text-sm font-semibold">{d.unread_notifications ? `${d.unread_notifications} unread` : 'All caught up'}</span></span><ArrowRight className="h-4 w-4" /></Link></Section>
          </div>
        </div>
      </>)}
    </div>
  )
}
