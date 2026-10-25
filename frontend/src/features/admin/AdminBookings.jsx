import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { CalendarClock, FileText, NotebookPen, Plus, Trash2, UserCheck, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/common/Button'
import { Field, Input, Select, Textarea, Checkbox } from '../../components/common/Field'
import { Modal } from '../../components/common/Modal'
import DataTable, { Pagination, SearchBox } from '../../components/common/DataTable'
import { Badge, ErrorState, Skeleton } from '../../components/common/Feedback'
import { KeyValue, PageHeader, Section, Tabs } from '../../components/common/Layout'
import StatusBadge from '../../components/common/StatusBadge'
import StatusTimeline from '../../components/tracking/StatusTimeline'
import { AddressBlock, InventoryTable, PaymentList, QuotationCard } from '../../components/booking/BookingBits'
import { adminApi } from '../../api/adminApi'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { STATUS, date, dateTime, errorMessage, money } from '../../utils/format'

export function AdminBookingsList() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const [f, setF] = useState({ status: sp.get('status') || '', date_from: '', date_to: '', destination: '' })
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); if (k === 'status') setSp(v ? { status: v } : {}) }
  const params = { page, search: dq || undefined, ordering: '-created_at', ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }
  const { data, loading, error, reload } = useApi(() => adminApi.bookings.list(params), [JSON.stringify(params)])
  const cols = [
    { key: 'reference', header: 'Reference', render: (r) => <span className="font-bold">{r.reference}</span> },
    { key: 'customer_name', header: 'Customer' },
    { key: 'route', header: 'Route', hideOnMobile: true, render: (r) => `${r.pickup_city} → ${r.drop_city}` },
    { key: 'move_date', header: 'Move date', render: (r) => date(r.move_date) },
    { key: 'driver_name', header: 'Driver', hideOnMobile: true, render: (r) => r.driver_name || <span className="text-navy-300">Unassigned</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'total', header: 'Quote', className: 'text-right tabular-nums', render: (r) => money(r.total) },
  ]
  return (
    <div>
      <PageHeader title="Bookings" subtitle="Search, filter and manage every booking." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Reference, customer, city" /></div>
        <Select aria-label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">All statuses</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        <Input type="date" aria-label="From date" value={f.date_from} onChange={(e) => set('date_from', e.target.value)} />
        <Input type="date" aria-label="To date" value={f.date_to} onChange={(e) => set('date_to', e.target.value)} />
      </div>
      <DataTable columns={cols} rows={data?.results} loading={loading} error={error} onRetry={reload} onRowClick={(r) => nav(`/admin/bookings/${r.id}`)} />
      {data && <Pagination page={page} count={data.count} onPage={setPage} />}
    </div>
  )
}

function Modalform({ open, onClose, title, submitLabel, onSubmit, children, size = 'sm' }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setErr(''); setBusy(false) } }, [open])
  return (
    <Modal open={open} onClose={onClose} title={title} size={size} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="mf" loading={busy}>{submitLabel}</Button></>}>
      <form id="mf" noValidate className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await onSubmit(); onClose() } catch (x) { setErr(errorMessage(x)) } finally { setBusy(false) } }}>
        {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{err}</p>}{children}
      </form>
    </Modal>
  )
}

export function AdminBookingDetail() {
  const { id } = useParams()
  const { data: b, loading, error, reload, setData } = useApi(() => adminApi.bookings.get(id), [id])
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const drivers = useApi(() => adminApi.drivers.list({ approval: 'APPROVED', page_size: 100 }), [])
  const notes = useApi(() => adminApi.bookings.internalNotes(id), [id])
  useEffect(() => { if (notes.data) setForm((f) => ({ ...f, internal_notes: notes.data.internal_notes })) }, [notes.data])
  const open = (m, init = {}) => { setForm((f) => ({ ...f, ...init })); setModal(m) }
  const close = () => setModal(null)
  const apply = (fn, msg) => async () => { const d = await fn(); setData ? setData(d) : reload(true); toast.success(msg); reload(true) }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading || !b) return <div className="space-y-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-96" /></div>
  const driverList = drivers.data?.results || drivers.data || []
  const latest = b.quotations?.[0]
  const canQuote = ['QUOTE_REQUESTED', 'QUOTE_PREPARED'].includes(b.status)
  const canAssign = ['CONFIRMED', 'DRIVER_ASSIGNED'].includes(b.status)
  const extra = form.extra_lines || []
  const setExtra = (i, k, v) => setForm((f) => ({ ...f, extra_lines: (f.extra_lines || []).map((x, j) => (j === i ? { ...x, [k]: v } : x)) }))

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: 'Bookings', to: '/admin/bookings' }, { label: b.reference }]} title={b.reference}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={b.status} /> {b.service_name} · {date(b.move_date)} {b.time_slot}{b.needs_manual_confirmation && <Badge tone="red">Needs manual confirmation</Badge>}{b.late_cancellation && <Badge tone="amber">Late cancellation</Badge>}</span>}
        actions={<div className="flex flex-wrap gap-2">
          {canQuote && <Button icon={FileText} onClick={() => open('quote', { extra_lines: [], use_pricing_rules: true, discount: '', discount_reason: '', notes: '', valid_days: '', distance_km: b.distance_km ?? '', vehicle_category: b.vehicle_category || '' })}>{latest ? 'Revise quotation' : 'Prepare quotation'}</Button>}
          {canAssign && <Button icon={UserCheck} onClick={() => open('driver', { driver: '', team_notes: '' })}>{b.driver_id ? 'Reassign driver' : 'Assign driver'}</Button>}
          {b.allowed_transitions?.length > 0 && <Button variant="outline" icon={Workflow} onClick={() => open('status', { status: '', reason: '' })}>Update status</Button>}
          <Button variant="outline" icon={CalendarClock} onClick={() => open('reschedule', { move_date: b.move_date, time_slot: b.time_slot || '' })}>Reschedule</Button>
        </div>} />
      {b.pending_reschedule && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p><b>Customer requested a new date:</b> {date(b.pending_reschedule.requested_date)} {b.pending_reschedule.requested_slot} — “{b.pending_reschedule.reason}”</p>
          <div className="flex gap-2"><Button size="sm" onClick={() => open('resolve', { approve: true, note: '' })}>Approve</Button><Button size="sm" variant="outline" onClick={() => open('resolve', { approve: false, note: '' })}>Decline</Button></div>
        </div>)}
      <Tabs className="mb-5 w-fit max-w-full" value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'quotes', label: 'Quotations', count: b.quotations?.length }, { value: 'inventory', label: 'Inventory' }, { value: 'payments', label: 'Payments' }, { value: 'activity', label: 'Activity' }, { value: 'notes', label: 'Internal notes' }]} />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Section title="Route"><div className="grid gap-4 sm:grid-cols-2">
              <AddressBlock title="Pickup" line1={b.pickup_line1} city={b.pickup_city} pincode={b.pickup_pincode} floor={b.pickup_floor} elevator={b.pickup_elevator} parking={b.pickup_parking} tone="brand" />
              <AddressBlock title="Drop" line1={b.drop_line1} city={b.drop_city} pincode={b.drop_pincode} floor={b.drop_floor} elevator={b.drop_elevator} parking={b.drop_parking} /></div></Section>
            <Section title="Job details"><KeyValue items={[['Property', b.property_label], ['Distance', b.distance_km ? `${b.distance_km} km` : 'Not set'], ['Vehicle', b.vehicle_category || 'Not set'], ['Packing', b.packing_required ? 'Yes' : 'No'], ['Loading', b.loading_required ? 'Yes' : 'No'], ['Unloading', b.unloading_required ? 'Yes' : 'No'], ['Add-ons', (b.addons || []).join(', ') || 'None'], ['Special instructions', b.special_instructions || 'None']]} /></Section>
          </div>
          <div className="space-y-6">
            <Section title="Customer"><KeyValue items={[['Name', b.customer_info.name], ['Email', b.customer_info.email], ['Phone', b.customer_info.phone]]} /><Link to={`/admin/customers?search=${encodeURIComponent(b.customer_info.email)}`} className="mt-3 inline-block text-sm font-semibold text-brand-600">View customer →</Link></Section>
            <Section title="Driver">{b.driver_info ? <KeyValue items={[['Name', b.driver_info.name], ['Phone', b.driver_info.phone], ['Vehicle', b.driver_info.vehicle || '-']]} /> : <p className="text-sm text-navy-400">No driver assigned.</p>}
              {b.assignments?.length > 0 && <ul className="mt-3 space-y-1 text-xs text-navy-400">{b.assignments.map((a) => <li key={a.id}>{a.driver} · {a.status.toLowerCase()} · {dateTime(a.created_at)}</li>)}</ul>}</Section>
            <Section title="Payment"><p className="text-sm">Paid <b>{money(b.payment_summary.paid)}</b> · Due <b>{money(b.payment_summary.due)}</b></p></Section>
          </div>
        </div>)}

      {tab === 'quotes' && (b.quotations?.length ? <div className="grid gap-5 lg:grid-cols-2">{b.quotations.map((q, i) => <QuotationCard key={q.id} q={q} highlight={i === 0} />)}</div> : <p className="text-sm text-navy-400">No quotation has been issued. Use “Prepare quotation”.</p>)}
      {tab === 'inventory' && <Section title="Inventory declared by customer"><InventoryTable items={b.inventory} /></Section>}
      {tab === 'payments' && <Section title="Payments"><PaymentList payments={b.payment_summary.payments} /><Link to="/admin/payments" className="mt-3 inline-block text-sm font-semibold text-brand-600">Manage refunds →</Link></Section>}
      {tab === 'activity' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Status history"><StatusTimeline status={b.status} history={b.history} /></Section>
          <Section title="Job events">{b.events?.length ? <ul className="space-y-3 text-sm">{b.events.map((e) => <li key={e.id}><b>{e.kind_label}</b> <span className="text-xs text-navy-400">· {e.actor_name} · {dateTime(e.created_at)}</span>{e.note && <p className="text-navy-500">{e.note}</p>}</li>)}</ul> : <p className="text-sm text-navy-400">No events yet.</p>}</Section>
        </div>)}
      {tab === 'notes' && (
        <Section title="Internal notes (never shown to the customer)">
          <Textarea rows={6} value={form.internal_notes || ''} onChange={set('internal_notes')} aria-label="Internal notes" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><Checkbox label="Flag: needs manual confirmation" checked={!!(form.needs_manual_confirmation ?? b.needs_manual_confirmation)} onChange={set('needs_manual_confirmation')} />
            <Button icon={NotebookPen} onClick={async () => { try { await adminApi.bookings.saveInternal(id, { internal_notes: form.internal_notes || '', needs_manual_confirmation: !!(form.needs_manual_confirmation ?? b.needs_manual_confirmation) }); toast.success('Notes saved.'); reload(true) } catch (e) { toast.error(errorMessage(e)) } }}>Save notes</Button></div>
        </Section>)}

      <Modalform open={modal === 'status'} onClose={close} title="Update status" submitLabel="Update" onSubmit={apply(() => adminApi.bookings.updateStatus(id, { status: form.status, reason: form.reason, expected_status: b.status }), 'Status updated.')}>
        <Field label="New status" required>{(a) => <Select {...a} value={form.status} onChange={set('status')} required><option value="">Select…</option>{b.allowed_transitions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>}</Field>
        <Field label="Reason / note" hint="Required when cancelling, rejecting or flagging an exception.">{(a) => <Textarea {...a} value={form.reason} onChange={set('reason')} />}</Field>
      </Modalform>
      <Modalform open={modal === 'driver'} onClose={close} title="Assign driver" submitLabel="Assign" onSubmit={apply(() => adminApi.bookings.assignDriver(id, { driver: form.driver, team_notes: form.team_notes }), 'Driver assigned.')}>
        <Field label="Driver" hint="Only approved drivers with a valid licence and no clash on this date are accepted." required>{(a) => <Select {...a} value={form.driver} onChange={set('driver')}><option value="">Select…</option>{driverList.map((d) => <option key={d.profile_id} value={d.profile_id}>{d.full_name} · {d.availability.toLowerCase().replace('_', ' ')}{d.vehicle_detail ? ` · ${d.vehicle_detail.registration_no}` : ''}</option>)}</Select>}</Field>
        <Field label="Team / helper notes">{(a) => <Textarea {...a} value={form.team_notes} onChange={set('team_notes')} />}</Field>
      </Modalform>
      <Modalform open={modal === 'reschedule'} onClose={close} title="Reschedule move" submitLabel="Reschedule" onSubmit={apply(() => adminApi.bookings.reschedule(id, { move_date: form.move_date, time_slot: form.time_slot }), 'Rescheduled. The customer was notified.')}>
        <Field label="New date" required>{(a) => <Input {...a} type="date" value={form.move_date} onChange={set('move_date')} />}</Field>
        <Field label="Time slot">{(a) => <Input {...a} value={form.time_slot} onChange={set('time_slot')} placeholder="e.g. Morning (8-12)" />}</Field>
      </Modalform>
      <Modalform open={modal === 'resolve'} onClose={close} title={form.approve ? 'Approve new date' : 'Decline request'} submitLabel={form.approve ? 'Approve' : 'Decline'} onSubmit={apply(() => adminApi.bookings.resolveReschedule(id, { approve: form.approve, note: form.note }), 'Request resolved.')}>
        <Field label="Note to customer">{(a) => <Textarea {...a} value={form.note} onChange={set('note')} />}</Field>
      </Modalform>
      <Modalform size="lg" open={modal === 'quote'} onClose={close} title={latest ? `Quotation v${(latest.version || 0) + 1}` : 'Prepare quotation'} submitLabel="Send to customer"
        onSubmit={apply(() => adminApi.bookings.quote(id, { use_pricing_rules: !!form.use_pricing_rules, distance_km: form.distance_km === '' ? undefined : form.distance_km, vehicle_category: form.vehicle_category || undefined, discount: form.discount || 0, discount_reason: form.discount_reason, notes: form.notes, valid_days: form.valid_days || undefined, extra_lines: extra.filter((x) => x.label).map((x) => ({ label: x.label, quantity: x.quantity || 1, unit_price: x.unit_price || 0 })) }), 'Quotation sent.')}>
        <Checkbox label="Calculate lines from configured pricing rules" checked={!!form.use_pricing_rules} onChange={set('use_pricing_rules')} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Distance (km)">{(a) => <Input {...a} type="number" min="0" step="0.1" value={form.distance_km} onChange={set('distance_km')} />}</Field>
          <Field label="Vehicle">{(a) => <Select {...a} value={form.vehicle_category} onChange={set('vehicle_category')}><option value="">Not set</option><option value="MINI">Mini truck</option><option value="SMALL">Small truck</option><option value="MEDIUM">Medium truck</option><option value="LARGE">Large truck</option></Select>}</Field>
          <Field label="Valid for (days)">{(a) => <Input {...a} type="number" min="1" value={form.valid_days} onChange={set('valid_days')} placeholder="Default" />}</Field>
        </div>
        <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Manual line items</p><Button type="button" size="sm" variant="outline" icon={Plus} onClick={() => setForm((f) => ({ ...f, extra_lines: [...(f.extra_lines || []), { label: '', quantity: 1, unit_price: '' }] }))}>Add line</Button></div>
          {extra.map((x, i) => <div key={i} className="mb-2 grid grid-cols-[1fr_70px_110px_auto] items-center gap-2"><Input aria-label="Description" placeholder="Description" value={x.label} onChange={(e) => setExtra(i, 'label', e.target.value)} /><Input aria-label="Quantity" type="number" min="0" step="any" value={x.quantity} onChange={(e) => setExtra(i, 'quantity', e.target.value)} /><Input aria-label="Unit price" type="number" min="0" step="any" placeholder="₹ price" value={x.unit_price} onChange={(e) => setExtra(i, 'unit_price', e.target.value)} /><button type="button" aria-label="Remove line" onClick={() => setForm((f) => ({ ...f, extra_lines: f.extra_lines.filter((_, j) => j !== i) }))} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>)}</div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Discount (₹)">{(a) => <Input {...a} type="number" min="0" step="any" value={form.discount} onChange={set('discount')} />}</Field><Field label="Discount reason">{(a) => <Input {...a} value={form.discount_reason} onChange={set('discount_reason')} />}</Field></div>
        <Field label="Notes to customer">{(a) => <Textarea {...a} value={form.notes} onChange={set('notes')} />}</Field>
        <p className="text-xs text-navy-400">GST and totals are calculated on the server from your business configuration. If no pricing rules exist, add manual lines.</p>
      </Modalform>
    </div>
  )
}
