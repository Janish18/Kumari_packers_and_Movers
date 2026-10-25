import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CalendarCheck, CheckCircle2, FileQuestion, IndianRupee, Truck, Users, Wallet, XCircle, Clock } from 'lucide-react'
import { adminApi } from '../../api/adminApi'
import { useApi } from '../../hooks/useApi'
import { ErrorState, Skeleton } from '../../components/common/Feedback'
import { PageHeader, Section } from '../../components/common/Layout'
import { AnimatedCounter, Stagger, StaggerItem } from '../../components/animations/Motion'
import { STATUS, money } from '../../utils/format'

const COLORS = ['#FF6B35', '#101B36', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#64748B']

function Metric({ icon: Icon, label, value, money: isMoney, to, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-500/10 text-brand-600', navy: 'bg-navy-900/10 text-navy-700 dark:text-navy-100', green: 'bg-emerald-500/10 text-emerald-600', red: 'bg-red-500/10 text-red-600', amber: 'bg-amber-500/10 text-amber-600', blue: 'bg-blue-500/10 text-blue-600' }
  const body = (
    <div className="card card-hover h-full p-5">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-4 text-2xl font-extrabold tabular-nums">{isMoney ? money(value, true) : <AnimatedCounter value={Number(value) || 0} />}</p>
      <p className="mt-0.5 text-sm text-navy-400">{label}</p>
    </div>)
  return to ? <Link to={to} className="block h-full">{body}</Link> : body
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi(adminApi.dashboard)
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
  const m = data.metrics
  const pie = data.status_breakdown.map((s) => ({ name: STATUS[s.status]?.label || s.status, value: s.count }))
  return (
    <div>
      <PageHeader title="Operations overview" subtitle="Live figures from your bookings and verified payments." />
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          <Metric key="a" icon={FileQuestion} label="Awaiting quotation" value={m.pending_quotations} to="/admin/bookings?status=QUOTE_REQUESTED" tone="amber" />,
          <Metric key="b" icon={Clock} label="Quote sent, awaiting customer" value={m.awaiting_customer} to="/admin/bookings?status=QUOTE_PREPARED" tone="blue" />,
          <Metric key="c" icon={CalendarCheck} label="Confirmed bookings" value={m.confirmed_bookings} to="/admin/bookings?status=CONFIRMED" tone="navy" />,
          <Metric key="d" icon={Truck} label="Jobs in progress" value={m.jobs_in_progress} tone="brand" />,
          <Metric key="e" icon={CheckCircle2} label="Completed jobs" value={m.completed_jobs} to="/admin/bookings?status=COMPLETED" tone="green" />,
          <Metric key="f" icon={XCircle} label="Cancellations" value={m.cancellations} to="/admin/bookings?status=CANCELLED" tone="red" />,
          <Metric key="g" icon={IndianRupee} label="Verified revenue (net of refunds)" value={m.revenue} money tone="green" />,
          <Metric key="h" icon={Wallet} label="Outstanding balance" value={m.outstanding_balance} money tone="amber" />,
        ].map((el, i) => <StaggerItem key={i}>{el}</StaggerItem>)}
      </Stagger>
      {(m.needs_review > 0 || data.drivers.pending_approval > 0 || data.pending_reviews > 0) && (
        <div className="mt-5 flex flex-wrap gap-3">
          {m.needs_review > 0 && <Link to="/admin/bookings?status=EXCEPTION_REQUIRES_REVIEW" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300"><AlertTriangle className="h-4 w-4" />{m.needs_review} job exception(s) need review</Link>}
          {data.drivers.pending_approval > 0 && <Link to="/admin/drivers" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><Users className="h-4 w-4" />{data.drivers.pending_approval} driver(s) awaiting approval</Link>}
          {data.pending_reviews > 0 && <Link to="/admin/support?tab=reviews" className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">{data.pending_reviews} review(s) to moderate</Link>}
        </div>)}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Section title="New bookings, last 30 days" className="lg:col-span-2">
          <div className="h-64" role="img" aria-label="Area chart of new bookings per day for the last 30 days">
            <ResponsiveContainer><AreaChart data={data.trend} margin={{ left: -20, right: 8, top: 8 }}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B35" stopOpacity={0.45} /><stop offset="100%" stopColor="#FF6B35" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} interval={4} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,.15)' }} />
              <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#FF6B35" strokeWidth={2.5} fill="url(#g)" />
            </AreaChart></ResponsiveContainer>
          </div>
        </Section>
        <Section title="Bookings by status">
          {pie.length ? <><div className="h-48" role="img" aria-label="Donut chart of bookings by status"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <ul className="mt-2 space-y-1 text-xs">{pie.map((p, i) => <li key={p.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{p.name}</span><b>{p.value}</b></li>)}</ul></>
            : <p className="py-10 text-center text-sm text-navy-400">No bookings yet.</p>}
        </Section>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[['Drivers', data.drivers.total], ['Available', data.drivers.available], ['On a job', data.drivers.busy], ['Jobs today', data.today_jobs]].map(([l, v]) => <div key={l} className="card p-4 text-center"><p className="text-2xl font-extrabold">{v}</p><p className="text-xs text-navy-400">{l}</p></div>)}
      </div>
    </div>
  )
}
