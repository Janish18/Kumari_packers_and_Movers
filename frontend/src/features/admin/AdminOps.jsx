import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Download, RotateCcw, Star } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/common/Button'
import { Field, Input, Select, Textarea } from '../../components/common/Field'
import { Modal } from '../../components/common/Modal'
import DataTable, { Pagination, SearchBox } from '../../components/common/DataTable'
import { Badge } from '../../components/common/Feedback'
import { PageHeader, Section, Tabs } from '../../components/common/Layout'
import { adminApi } from '../../api/adminApi'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { applyFieldErrors, addDays, dateTime, errorMessage, money, today } from '../../utils/format'

const PTONE = { SUCCESS: 'green', FAILED: 'red', PENDING: 'amber', REFUNDED: 'slate', PARTIALLY_REFUNDED: 'blue' }

export function AdminPayments() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const dq = useDebounce(q)
  const [target, setTarget] = useState(null)
  const { data, loading, error, reload } = useApi(() => adminApi.payments.list({ page, search: dq || undefined, status: status || undefined, ordering: '-created_at' }), [page, dq, status])
  const f = useForm()
  const refundable = (p) => ['SUCCESS', 'PARTIALLY_REFUNDED'].includes(p.status)
  const left = (p) => Number(p.amount) - (p.refunds || []).filter((r) => r.status !== 'FAILED').reduce((s, r) => s + Number(r.amount), 0)
  const submit = async (v) => {
    try { await adminApi.payments.refund(target.id, { amount: v.amount, reason: v.reason }); toast.success('Refund initiated.'); setTarget(null); reload(true) }
    catch (e) { if (!applyFieldErrors(e, f.setError)) toast.error(errorMessage(e)) }
  }
  const cols = [
    { key: 'booking_reference', header: 'Booking', render: (p) => <b>{p.booking_reference}</b> }, { key: 'customer_name', header: 'Customer', hideOnMobile: true },
    { key: 'kind', header: 'Type', render: (p) => p.kind.toLowerCase() }, { key: 'amount', header: 'Amount', className: 'tabular-nums', render: (p) => money(p.amount) },
    { key: 'status', header: 'Status', render: (p) => <Badge tone={PTONE[p.status] || 'slate'}>{p.status.replace('_', ' ').toLowerCase()}</Badge> },
    { key: 'created_at', header: 'Date', hideOnMobile: true, render: (p) => dateTime(p.created_at) },
    { key: 'a', header: '', className: 'text-right', render: (p) => refundable(p) && <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => { f.reset({ amount: left(p).toFixed(2), reason: '' }); setTarget(p) }}>Refund</Button> },
  ]
  return (
    <div>
      <PageHeader title="Payments & refunds" subtitle="Only gateway-verified payments are marked successful." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3"><div className="sm:col-span-2"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Booking, customer, gateway id" /></div>
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">All statuses</option>{Object.keys(PTONE).map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select></div>
      <DataTable columns={cols} rows={data?.results} loading={loading} error={error} onRetry={reload} />
      {data && <Pagination page={page} count={data.count} onPage={setPage} />}
      <Modal open={!!target} onClose={() => setTarget(null)} title="Issue refund" size="sm" description={target && `${target.booking_reference} · paid ${money(target.amount)}`}
        footer={<><Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button><Button type="submit" form="rf" loading={f.formState.isSubmitting}>Refund via gateway</Button></>}>
        <form id="rf" onSubmit={f.handleSubmit(submit)} noValidate className="space-y-4">
          <Field label="Amount (₹)" error={f.formState.errors.amount?.message}>{(a) => <Input {...a} type="number" step="0.01" min="0" {...f.register('amount', { required: 'Enter an amount' })} />}</Field>
          <Field label="Reason" error={f.formState.errors.reason?.message}>{(a) => <Textarea {...a} {...f.register('reason', { required: 'A reason is required' })} />}</Field>
        </form>
      </Modal>
    </div>
  )
}

function ModerationModal({ open, onClose, title, fields, row, onSave, statuses }) {
  const f = useForm()
  const [busy, setBusy] = useState(false)
  if (row && f.getValues('__id') !== row.id) f.reset({ ...row, __id: row.id })
  return (
    <Modal open={open} onClose={onClose} title={title} size="md" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="mod" loading={busy}>Save</Button></>}>
      {row && <form id="mod" noValidate className="space-y-4" onSubmit={f.handleSubmit(async (v) => { setBusy(true); try { await onSave(row.id, Object.fromEntries(fields.concat([{ name: 'status' }]).map((x) => [x.name, v[x.name]]))); toast.success('Saved.'); onClose() } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) } })}>
        <div className="rounded-xl bg-navy-50 p-4 text-sm dark:bg-navy-800"><p className="font-bold">{row.subject || row.item_name || row.booking_reference}</p><p className="mt-1 text-navy-500">{row.message || row.description || row.comment}</p><p className="mt-2 text-xs text-navy-400">{row.customer_name} {row.customer_email ? `· ${row.customer_email}` : ''} · {dateTime(row.created_at)}</p></div>
        <Field label="Status"><Select {...f.register('status')}>{statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select></Field>
        {fields.map((x) => <Field key={x.name} label={x.label} hint={x.hint}>{(a) => <Textarea {...a} {...f.register(x.name)} />}</Field>)}
      </form>}
    </Modal>
  )
}

export function AdminSupport() {
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'tickets'
  const [row, setRow] = useState(null)
  const tickets = useApi(() => adminApi.tickets.list({ page_size: 50, ordering: '-created_at' }), [])
  const damage = useApi(() => adminApi.damage.list({ page_size: 50, ordering: '-created_at' }), [])
  const reviews = useApi(() => adminApi.reviews.list({ page_size: 50, ordering: '-created_at' }), [])
  const T = { OPEN: 'blue', IN_PROGRESS: 'amber', RESOLVED: 'green', CLOSED: 'slate', INVESTIGATING: 'amber', REJECTED: 'red', PENDING: 'amber', APPROVED: 'green' }
  const badge = (r) => <Badge tone={T[r.status]}>{r.status.replace('_', ' ').toLowerCase()}</Badge>
  const stars = (n) => <span className="flex items-center gap-0.5 text-amber-500"><Star className="h-4 w-4 fill-current" />{n}</span>
  const cfg = {
    tickets: { src: tickets, api: adminApi.tickets, title: 'Support ticket', statuses: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], fields: [{ name: 'resolution', label: 'Reply to customer' }, { name: 'internal_notes', label: 'Internal notes' }],
      cols: [{ key: 'subject', header: 'Subject', render: (r) => <b>{r.subject}</b> }, { key: 'customer_name', header: 'Customer', hideOnMobile: true }, { key: 'booking_reference', header: 'Booking', hideOnMobile: true }, { key: 'status', header: 'Status', render: badge }, { key: 'created_at', header: 'Opened', render: (r) => dateTime(r.created_at) }] },
    damage: { src: damage, api: adminApi.damage, title: 'Damage / missing report', statuses: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED'], fields: [{ name: 'resolution', label: 'Resolution (visible to customer)' }, { name: 'internal_notes', label: 'Internal notes' }],
      cols: [{ key: 'item_name', header: 'Item', render: (r) => <b>{r.kind === 'DAMAGE' ? 'Damaged' : 'Missing'}: {r.item_name}</b> }, { key: 'customer_name', header: 'Customer', hideOnMobile: true }, { key: 'booking_reference', header: 'Booking' }, { key: 'estimated_value', header: 'Est. value', render: (r) => money(r.estimated_value) }, { key: 'status', header: 'Status', render: badge }] },
    reviews: { src: reviews, api: adminApi.reviews, title: 'Review moderation', statuses: ['PENDING', 'APPROVED', 'REJECTED'], fields: [{ name: 'admin_response', label: 'Public response (optional)', hint: 'Shown with the review if approved.' }],
      cols: [{ key: 'rating', header: 'Rating', render: (r) => stars(r.rating) }, { key: 'comment', header: 'Comment', render: (r) => <span className="line-clamp-2">{r.comment || '-'}</span> }, { key: 'customer_name', header: 'Customer', hideOnMobile: true }, { key: 'booking_reference', header: 'Booking', hideOnMobile: true }, { key: 'status', header: 'Status', render: badge }] },
  }[tab]
  const rows = cfg.src.data?.results || cfg.src.data
  return (
    <div>
      <PageHeader title="Support & quality" subtitle="Tickets, damage claims and customer reviews." />
      <Tabs className="mb-5 w-fit max-w-full" value={tab} onChange={(v) => setSp({ tab: v })} tabs={[{ value: 'tickets', label: 'Tickets', count: tickets.data?.count }, { value: 'damage', label: 'Damage reports', count: damage.data?.count }, { value: 'reviews', label: 'Reviews', count: reviews.data?.count }]} />
      <DataTable columns={cfg.cols} rows={rows} loading={cfg.src.loading} error={cfg.src.error} onRetry={cfg.src.reload} onRowClick={setRow} />
      <ModerationModal open={!!row} onClose={() => setRow(null)} row={row} title={cfg.title} fields={cfg.fields} statuses={cfg.statuses} onSave={async (id, body) => { await cfg.api.update(id, body); cfg.src.reload(true) }} />
    </div>
  )
}

export function AdminReports() {
  const [type, setType] = useState('bookings')
  const [range, setRange] = useState({ date_from: addDays(-29), date_to: today() })
  const params = { type, ...range }
  const { data, loading, error, reload } = useApi(() => adminApi.report(params), [JSON.stringify(params)])
  const [busy, setBusy] = useState(false)
  const cols = data ? data.headers.map((h, i) => ({ key: String(i), header: h, render: (r) => String(r[i] ?? '') })) : []
  const rows = data ? data.rows.map((r, i) => ({ ...r, id: i })) : []
  return (
    <div>
      <PageHeader title="Reports" subtitle="Export any report as CSV. Exports are recorded in the audit log." actions={<Button icon={Download} loading={busy} onClick={async () => { setBusy(true); try { await adminApi.exportReport(params) } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) } }}>Export CSV</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select aria-label="Report" value={type} onChange={(e) => setType(e.target.value)}>{[['bookings', 'Bookings'], ['revenue', 'Revenue (payments)'], ['drivers', 'Driver activity'], ['cancellations', 'Cancellations'], ['quality', 'Customer feedback']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <Input type="date" aria-label="From" value={range.date_from} onChange={(e) => setRange((r) => ({ ...r, date_from: e.target.value }))} />
        <Input type="date" aria-label="To" value={range.date_to} onChange={(e) => setRange((r) => ({ ...r, date_to: e.target.value }))} />
      </div>
      {data && <p className="mb-3 text-sm text-navy-400">{data.summary.count} row(s)</p>}
      <DataTable columns={cols} rows={rows.slice(0, 200)} loading={loading} error={error} onRetry={reload} />
      {rows.length > 200 && <p className="mt-2 text-xs text-navy-400">Showing the first 200 rows. Export CSV for everything.</p>}
    </div>
  )
}

export function AdminAudit() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const { data, loading, error, reload } = useApi(() => adminApi.audit({ page, search: dq || undefined }), [page, dq])
  const cols = [{ key: 'created_at', header: 'When', render: (r) => dateTime(r.created_at) }, { key: 'actor_name', header: 'Who' }, { key: 'action', header: 'Action', render: (r) => <Badge tone="slate">{r.action.replace(/_/g, ' ')}</Badge> }, { key: 'summary', header: 'Details', hideOnMobile: true }, { key: 'ip_address', header: 'IP', hideOnMobile: true }]
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Who did what, and when. Read-only." />
      <div className="mb-4 max-w-sm"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search actions, people, details" /></div>
      <DataTable columns={cols} rows={data?.results} loading={loading} error={error} onRetry={reload} />
      {data && <Pagination page={page} count={data.count} onPage={setPage} />}
    </div>
  )
}
