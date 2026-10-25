import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { AlertTriangle, CalendarClock, Download, ExternalLink, Headphones, MapPin, Pencil, Phone, Radio, Send, Star, Truck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/common/Button'
import { Field, Input, Select, Textarea } from '../../components/common/Field'
import { Modal, ConfirmDialog } from '../../components/common/Modal'
import { Badge, ErrorState, Skeleton } from '../../components/common/Feedback'
import { KeyValue, PageHeader, Section, Tabs } from '../../components/common/Layout'
import StatusBadge from '../../components/common/StatusBadge'
import StatusTimeline from '../../components/tracking/StatusTimeline'
import { AddressBlock, InventoryTable, PaymentList, QuotationCard } from '../../components/booking/BookingBits'
import { bookingApi } from '../../api/bookingApi'
import { useApi } from '../../hooks/useApi'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { useAuth } from '../auth/AuthContext'
import { usePayment } from '../payments/usePayment'
import { addDays, applyFieldErrors, date, dateTime, errorMessage, money, today } from '../../utils/format'

function StarInput({ value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="group rounded-lg p-1 transition hover:scale-125">
          <Star className={clsx('h-8 w-8 transition-colors', n <= value ? 'fill-amber-400 text-amber-400' : 'text-navy-200 group-hover:text-amber-300')} />
        </button>
      ))}
    </div>
  )
}

/** A small form-in-a-modal helper that surfaces server field errors. */
function FormModal({ open, onClose, title, description, submitLabel, onSubmit, children, danger }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setErr(''); setBusy(false) } }, [open])
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await onSubmit(); onClose() } catch (ex) { setErr(errorMessage(ex)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} type="submit" form="kpm-form" loading={busy}>{submitLabel}</Button></>}>
      <form id="kpm-form" onSubmit={submit} className="space-y-4">{err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{err}</p>}{children}</form>
    </Modal>
  )
}

function TrackingPanel({ id, active }) {
  const { data: t, loading, error, reload } = useApi(() => bookingApi.tracking(id), [id])
  useEffect(() => { if (!active) return undefined; const i = setInterval(() => reload(true), 20000); return () => clearInterval(i) }, [active, reload])
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <Skeleton className="h-64 w-full" />
  const loc = t.live.last_location
  return (
    <div className="space-y-6">
      <div className={clsx('flex items-start gap-4 rounded-2xl p-5', t.live.available ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-navy-50 dark:bg-navy-800')}>
        <span className="relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-soft dark:bg-navy-900">{t.live.available && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-400/50" />}<Radio className={clsx('relative h-5 w-5', t.live.available ? 'text-emerald-600' : 'text-navy-300')} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t.live.available ? 'Live location is shared' : 'Live location unavailable'}</p>
          {loc ? (<><p className="mt-1 text-sm text-navy-500">Last update {dateTime(loc.recorded_at)}</p>
            <a href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=15/${loc.latitude}/${loc.longitude}`} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600">View on map <ExternalLink className="h-3.5 w-3.5" /></a></>)
            : <p className="mt-1 text-sm text-navy-500">{t.live.reason} Status updates below are still recorded by the team.</p>}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Journey"><StatusTimeline status={t.status} history={t.timeline} /></Section>
        <Section title="Updates from the team">
          {!t.events.length ? <p className="text-sm text-navy-400">Team updates appear here as the job progresses.</p> : (
            <ol className="space-y-4">{[...t.events].reverse().map((e) => <li key={e.id} className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" /><div><p className="text-sm font-semibold">{e.kind_label}{e.note && e.kind !== 'STATUS' ? <span className="font-normal text-navy-500"> — {e.note}</span> : null}</p><p className="text-xs text-navy-400">{dateTime(e.created_at)}{e.actor_name ? ` · ${e.actor_name}` : ''}</p></div></li>)}</ol>)}
        </Section>
      </div>
    </div>
  )
}

export default function BookingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const { config } = useSiteConfig()
  const { data: b, loading, error, reload } = useApi(() => bookingApi.get(id), [id])
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(null)
  const [accepting, setAccepting] = useState(false)
  const [f, setF] = useState({})
  const { pay, busy: paying } = usePayment(() => reload(true))
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.value ?? e }))
  const open = (m, init = {}) => { setF(init); setModal(m) }

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <div className="space-y-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-64 w-full" /></div>
  const a = b.actions
  const latest = b.quotations.find((q) => q.status === 'SENT') || b.quotations.find((q) => q.status === 'ACCEPTED')
  const paid = Number(b.payment_summary.paid), due = b.payment_summary.due == null ? null : Number(b.payment_summary.due)
  const live = ['EN_ROUTE_TO_PICKUP', 'LOADING', 'IN_TRANSIT', 'UNLOADING'].includes(b.status)

  const acceptQuote = async (q) => {
    setAccepting(true)
    try { await bookingApi.acceptQuote(b.id, q.id); toast.success('Quotation accepted. We will confirm your booking shortly.'); reload(true) } catch (e) { toast.error(errorMessage(e)); reload(true) } finally { setAccepting(false) }
  }
  const slots = Array.isArray(config?.time_slots) ? config.time_slots : []
  const tabs = [{ value: 'overview', label: 'Overview' }, { value: 'quotation', label: 'Quotation', count: b.quotations.length || null }, { value: 'inventory', label: 'Inventory', count: b.inventory.length || null }, { value: 'payments', label: 'Payments' }, ...(a.can_track ? [{ value: 'tracking', label: 'Tracking' }] : [])]

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: 'Bookings', to: '/app/bookings' }, { label: b.reference }]} title={b.reference}
        subtitle={`${b.service_name} · ${b.pickup_city} → ${b.drop_city} · ${date(b.move_date)}${b.time_slot ? ` · ${b.time_slot}` : ''}`} actions={<StatusBadge status={b.status} />} />

      {b.needs_manual_confirmation && !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(b.status) && <div className="mb-5 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />One of your locations needs manual confirmation. We'll confirm availability when we prepare your quotation.</div>}
      {b.status === 'QUOTE_PREPARED' && a.can_accept_quote && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 p-5 text-white shadow-glow"><div><p className="font-display text-lg font-extrabold">Your quotation is ready</p><p className="text-sm text-white/85">Review the itemised breakdown and accept to proceed.</p></div><Button variant="navy" onClick={() => setTab('quotation')}>Review quotation</Button></motion.div>}

      <div className="mb-6 flex flex-wrap gap-2">
        {a.can_edit && <Link to={`/app/bookings/${b.id}/edit`} className="btn btn-outline btn-sm"><Pencil className="h-4 w-4" />Edit draft</Link>}
        {a.can_submit && <Button size="sm" icon={Send} onClick={async () => { try { await bookingApi.submit(b.id); toast.success('Quotation requested.'); reload(true) } catch (e) { toast.error(errorMessage(e)) } }}>Request quotation</Button>}
        {a.can_pay && due > 0 && (<>
          {paid === 0 && b.status !== 'COMPLETED' && <Button size="sm" loading={paying} onClick={() => pay(b, 'ADVANCE', user)}>Pay advance</Button>}
          <Button size="sm" variant={paid === 0 ? 'outline' : 'primary'} loading={paying} onClick={() => pay(b, paid === 0 ? 'FULL' : 'BALANCE', user)}>{paid === 0 ? (b.status === 'COMPLETED' ? `Pay now (${money(due)})` : 'Pay in full') : `Pay balance (${money(due)})`}</Button>
        </>)}
        {b.invoice_id && <Button size="sm" variant="outline" icon={Download} onClick={() => bookingApi.downloadInvoice(b.invoice_id).catch((e) => toast.error(errorMessage(e)))}>Invoice</Button>}
        {a.can_reschedule && !b.pending_reschedule && <Button size="sm" variant="outline" icon={CalendarClock} onClick={() => open('reschedule', { requested_date: addDays(7), requested_slot: '', reason: '' })}>Reschedule</Button>}
        {a.can_report_damage && <Button size="sm" variant="outline" icon={AlertTriangle} onClick={() => open('damage', { kind: 'DAMAGE', item_name: '', description: '', estimated_value: '', files: [] })}>Report damage / missing item</Button>}
        {a.can_review && <Button size="sm" icon={Star} onClick={() => open('review', { rating: 5, driver_rating: 5, comment: '' })}>Leave a review</Button>}
        <Button size="sm" variant="ghost" icon={Headphones} onClick={() => open('ticket', { subject: '', message: '' })}>Contact support</Button>
        {a.can_cancel && <Button size="sm" variant="ghost" className="!text-red-600" icon={XCircle} onClick={() => open('cancel', { reason: '' })}>Cancel booking</Button>}
      </div>
      {b.pending_reschedule && <p className="mb-5 rounded-xl bg-sky-soft p-3 text-sm dark:bg-navy-800">A reschedule to <b>{date(b.pending_reschedule.requested_date)}</b> is awaiting confirmation.</p>}

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-6 max-w-full" />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-6">
                <Section title="Addresses"><div className="grid gap-4 sm:grid-cols-2"><AddressBlock title="Pickup" line1={b.pickup_line1} city={b.pickup_city} pincode={b.pickup_pincode} floor={b.pickup_floor} elevator={b.pickup_elevator} parking={b.pickup_parking} /><AddressBlock tone="brand" title="Delivery" line1={b.drop_line1} city={b.drop_city} pincode={b.drop_pincode} floor={b.drop_floor} elevator={b.drop_elevator} parking={b.drop_parking} /></div></Section>
                <Section title="Move details"><KeyValue items={[['Property', b.property_label], ['Service', b.service_name], ['Packing', b.packing_required ? 'Yes' : 'No'], ['Loading / unloading', b.unloading_required ? 'Both ends' : 'Loading only'], ['Add-ons', b.addons?.length ? b.addons.join(', ') : 'None'], ['Vehicle', b.vehicle_category || 'To be assigned'], ['Distance', b.distance_km ? `${b.distance_km} km` : '-'], ['Special instructions', b.special_instructions || '-']]} /></Section>
                {b.cancelled_reason && <Section title="Cancellation"><p className="text-sm">{b.cancelled_reason}</p>{b.late_cancellation && <p className="mt-2 text-xs text-amber-700">Cancelled close to the move date; a late-cancellation fee may apply per our policy.</p>}</Section>}
              </div>
              <div className="space-y-6">
                <Section title="Status timeline"><StatusTimeline status={b.status} history={b.history} /></Section>
                {b.driver_info && <Section title="Your moving team"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-full bg-navy-900 text-white"><Truck className="h-5 w-5" /></span><div><p className="font-bold">{b.driver_info.name}</p><p className="text-xs text-navy-400">{b.driver_info.vehicle} {b.driver_info.vehicle_category && `· ${b.driver_info.vehicle_category}`}</p></div></div>{b.driver_info.team && <p className="mt-3 text-sm text-navy-500">Team: {b.driver_info.team}</p>}{b.driver_info.phone && <a href={`tel:${b.driver_info.phone}`} className="btn btn-outline btn-sm mt-4"><Phone className="h-4 w-4" />Call driver</a>}</Section>}
              </div>
            </div>
          )}
          {tab === 'quotation' && (!b.quotations.length ? <Section title="Quotation"><p className="text-sm text-navy-400">{b.status === 'DRAFT' ? 'Submit your request to receive a quotation.' : 'Our team is preparing your itemised quotation. You will be notified when it is ready.'}</p></Section> : <div className="grid gap-6 lg:grid-cols-2">{b.quotations.map((q) => <QuotationCard key={q.id} q={q} highlight={q.id === latest?.id} canAccept={a.can_accept_quote && q.id === latest?.id} accepting={accepting} onAccept={acceptQuote} />)}</div>)}
          {tab === 'inventory' && <Section title="Inventory"><InventoryTable items={b.inventory} /></Section>}
          {tab === 'payments' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <Section title="Summary"><dl className="space-y-3 text-sm"><div className="flex justify-between"><dt className="text-navy-400">Quoted total</dt><dd className="font-bold tabular-nums">{latest && b.quotations.some((q) => q.status === 'ACCEPTED') ? money(latest.total) : 'Not accepted yet'}</dd></div><div className="flex justify-between"><dt className="text-navy-400">Paid</dt><dd className="font-bold tabular-nums text-emerald-600">{money(paid)}</dd></div><div className="flex justify-between border-t border-navy-100 pt-3 text-base dark:border-navy-800"><dt className="font-bold">Balance due</dt><dd className="font-extrabold tabular-nums text-brand-600">{due == null ? '-' : money(due)}</dd></div></dl>{!a.can_pay && b.status === 'QUOTE_PREPARED' && <p className="mt-4 text-xs text-navy-400">Accept your quotation to unlock payment.</p>}</Section>
              <Section title="Payment history"><PaymentList payments={b.payment_summary.payments} /></Section>
            </div>
          )}
          {tab === 'tracking' && <TrackingPanel id={b.id} active={live} />}
        </motion.div>
      </AnimatePresence>

      {/* ---- modals ---- */}
      <FormModal open={modal === 'cancel'} onClose={() => setModal(null)} danger title="Cancel this booking?" description="Cancelling close to the move date may incur a fee per our cancellation policy." submitLabel="Cancel booking"
        onSubmit={async () => { if (!f.reason?.trim()) throw { response: { data: { error: { message: 'Please tell us why you are cancelling.' } } } }; const r = await bookingApi.cancel(b.id, f.reason); toast.success(r.message); reload(true) }}>
        <Field label="Reason" required>{(x) => <Textarea {...x} data-autofocus value={f.reason || ''} onChange={set('reason')} placeholder="Reason for cancelling" />}</Field>
      </FormModal>
      <FormModal open={modal === 'reschedule'} onClose={() => setModal(null)} title="Reschedule your move" description={['CONFIRMED', 'DRIVER_ASSIGNED'].includes(b.status) ? 'Our team will confirm the new date based on availability.' : 'Your date will update immediately.'} submitLabel="Request new date"
        onSubmit={async () => { const r = await bookingApi.reschedule(b.id, f); toast.success(r.message); reload(true) }}>
        <Field label="New date" required>{(x) => <Input {...x} type="date" min={today()} value={f.requested_date || ''} onChange={set('requested_date')} />}</Field>
        <Field label="Time slot">{(x) => slots.length ? <Select {...x} value={f.requested_slot || ''} onChange={set('requested_slot')}><option value="">No preference</option>{slots.map((s) => <option key={s}>{s}</option>)}</Select> : <Input {...x} value={f.requested_slot || ''} onChange={set('requested_slot')} />}</Field>
        <Field label="Reason">{(x) => <Input {...x} value={f.reason || ''} onChange={set('reason')} />}</Field>
      </FormModal>
      <FormModal open={modal === 'review'} onClose={() => setModal(null)} title="How was your move?" description="Reviews are published after moderation." submitLabel="Submit review"
        onSubmit={async () => { await bookingApi.createReview({ booking: b.id, rating: f.rating, driver_rating: f.driver_rating, comment: f.comment }); toast.success('Thank you for your feedback!'); reload(true) }}>
        <div><p className="label">Overall</p><StarInput label="Overall rating" value={f.rating || 0} onChange={set('rating')} /></div>
        <div><p className="label">Driver &amp; team</p><StarInput label="Driver rating" value={f.driver_rating || 0} onChange={set('driver_rating')} /></div>
        <Field label="Comments">{(x) => <Textarea {...x} maxLength={1500} value={f.comment || ''} onChange={set('comment')} placeholder="Tell others about your experience" />}</Field>
      </FormModal>
      <FormModal open={modal === 'damage'} onClose={() => setModal(null)} title="Report damage or a missing item" submitLabel="Submit report"
        onSubmit={async () => { const r = await bookingApi.createDamage({ booking: b.id, kind: f.kind, item_name: f.item_name, description: f.description, estimated_value: f.estimated_value || null }); for (const file of f.files || []) { try { await bookingApi.uploadDamagePhoto(r.id, file) } catch { toast.warning('A photo could not be uploaded.') } } toast.success('Report submitted. Our team will investigate.') }}>
        <Field label="Type">{(x) => <Select {...x} value={f.kind || 'DAMAGE'} onChange={set('kind')}><option value="DAMAGE">Damaged item</option><option value="MISSING">Missing item</option></Select>}</Field>
        <Field label="Item" required>{(x) => <Input {...x} value={f.item_name || ''} onChange={set('item_name')} />}</Field>
        <Field label="What happened?" required>{(x) => <Textarea {...x} value={f.description || ''} onChange={set('description')} />}</Field>
        <Field label="Estimated value (₹)">{(x) => <Input {...x} type="number" min="0" value={f.estimated_value || ''} onChange={set('estimated_value')} />}</Field>
        <Field label="Photos" hint="JPEG, PNG or WebP, max 5 MB each">{(x) => <input {...x} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setF((s) => ({ ...s, files: [...e.target.files].slice(0, 5) }))} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700" />}</Field>
      </FormModal>
      <FormModal open={modal === 'ticket'} onClose={() => setModal(null)} title="Contact support" description={`About booking ${b.reference}`} submitLabel="Send"
        onSubmit={async () => { await bookingApi.createTicket({ booking: b.id, subject: f.subject, message: f.message }); toast.success('Support request sent.') }}>
        <Field label="Subject" required>{(x) => <Input {...x} value={f.subject || ''} onChange={set('subject')} />}</Field>
        <Field label="Message" required>{(x) => <Textarea {...x} value={f.message || ''} onChange={set('message')} />}</Field>
      </FormModal>
    </div>
  )
}
