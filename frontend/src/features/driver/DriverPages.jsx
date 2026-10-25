import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, Camera, CheckCircle2, ChevronRight, MapPin, Navigation, Phone, Radio, Send, Truck, UserCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/common/Button'
import { Field, Input, Select, Textarea, Toggle } from '../../components/common/Field'
import { Modal } from '../../components/common/Modal'
import { Badge, EmptyState, ErrorState, Skeleton, SkeletonList } from '../../components/common/Feedback'
import { Section, Tabs } from '../../components/common/Layout'
import StatusBadge from '../../components/common/StatusBadge'
import { Pagination } from '../../components/common/DataTable'
import { AddressBlock, InventoryTable } from '../../components/booking/BookingBits'
import { driverApi } from '../../api/driverApi'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../auth/AuthContext'
import { date, dateTime, errorMessage } from '../../utils/format'

function JobCard({ j }) {
  return (
    <Link to={`/driver/jobs/${j.id}`} className="card card-hover block p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{j.reference}</p><p className="text-xs text-navy-400">{date(j.move_date)} · {j.time_slot || 'Time TBC'}</p></div><StatusBadge status={j.status} /></div>
      <div className="mt-3 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-brand-500" /><span className="truncate">{j.pickup_city}</span><ChevronRight className="h-4 w-4 shrink-0 text-navy-300" /><span className="truncate">{j.drop_city}</span></div>
      {!j.acknowledged && j.status === 'DRIVER_ASSIGNED' && <Badge tone="amber" className="mt-3">Tap to acknowledge</Badge>}
    </Link>
  )
}

export function DriverHome() {
  const { data, loading, error, reload } = useApi(driverApi.dashboard)
  const [busy, setBusy] = useState(false)
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-40" /></div>
  const p = data.profile
  const toggle = async () => {
    setBusy(true)
    try { await driverApi.updateProfile({ availability: p.availability === 'AVAILABLE' ? 'OFF_DUTY' : 'AVAILABLE' }); reload(true) } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-white shadow-glow-navy">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-3xl" />
        <p className="text-sm text-white/60">Hello,</p><p className="font-display text-2xl font-extrabold">{p.name}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge tone={p.approval === 'APPROVED' ? 'green' : 'amber'}>{p.approval.toLowerCase()}</Badge>
          <span className="text-sm text-white/70">{p.vehicle ? `Vehicle ${p.vehicle}` : 'No vehicle assigned'}</span></div>
        {p.approval === 'APPROVED' ? (
          <button onClick={toggle} disabled={busy || p.availability === 'BUSY'} className={clsx('mt-5 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left font-semibold transition disabled:opacity-60', p.availability === 'AVAILABLE' ? 'bg-emerald-500' : 'bg-white/10')}>
            <span>{p.availability === 'BUSY' ? 'On a job' : p.availability === 'AVAILABLE' ? 'You are available' : 'You are off duty'}</span>
            <span className="text-xs opacity-80">{p.availability === 'BUSY' ? '' : p.availability === 'AVAILABLE' ? 'Tap to go off duty' : 'Tap to go available'}</span></button>
        ) : <p className="mt-4 rounded-xl bg-white/10 p-3 text-sm">Your account is awaiting approval by the admin team. You will receive jobs once approved.</p>}
      </div>
      {data.active_job && <div><h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-brand-600">Active job</h2><JobCard j={data.active_job} /></div>}
      <div><h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-navy-400">Today</h2>{data.today.length ? <div className="space-y-3">{data.today.map((j) => <JobCard key={j.id} j={j} />)}</div> : <EmptyState icon={Truck} title="No jobs today" text="New assignments will appear here and in Alerts." />}</div>
      {data.upcoming.length > 0 && <div><h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-navy-400">Upcoming</h2><div className="space-y-3">{data.upcoming.map((j) => <JobCard key={j.id} j={j} />)}</div></div>}
      <p className="text-center text-xs text-navy-400">{data.completed_count} job(s) completed</p>
    </div>
  )
}

export function DriverJobs() {
  const [tab, setTab] = useState('active')
  const [page, setPage] = useState(1)
  const params = tab === 'done' ? { status: 'COMPLETED', page, ordering: '-move_date' } : { page, ordering: 'move_date' }
  const { data, loading, error, reload } = useApi(() => driverApi.jobs(params), [tab, page])
  const rows = (data?.results || []).filter((j) => (tab === 'done' ? true : !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(j.status)))
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">My jobs</h1>
      <Tabs className="mb-4 w-fit" value={tab} onChange={(v) => { setTab(v); setPage(1) }} tabs={[{ value: 'active', label: 'Active' }, { value: 'done', label: 'Completed' }]} />
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <SkeletonList /> : !rows.length ? <EmptyState icon={Truck} title={tab === 'done' ? 'No completed jobs yet' : 'No active jobs'} /> : <div className="space-y-3">{rows.map((j) => <JobCard key={j.id} j={j} />)}</div>}
      {data && <Pagination page={page} count={data.count} onPage={setPage} />}
    </div>
  )
}

/** Sends the device location only while: driver consented, job is live, page is open. */
function useLocationSharing(job, enabled, onState) {
  const last = useRef(0)
  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) return undefined
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - last.current < 30000) return
        last.current = now
        driverApi.sendLocation(job.id, { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy_m: Math.round(pos.coords.accuracy) }).then(() => onState('sharing')).catch(() => onState('error'))
      },
      (err) => onState(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, job.id]) // eslint-disable-line react-hooks/exhaustive-deps
}

const LIVE = ['EN_ROUTE_TO_PICKUP', 'LOADING', 'IN_TRANSIT', 'UNLOADING']
const EVENT_KINDS = [['ARRIVED_PICKUP', 'Arrived at pickup'], ['LOADING_DONE', 'Loading finished'], ['ARRIVED_DROP', 'Arrived at drop'], ['UNLOADING_DONE', 'Unloading finished'], ['DELAY', 'Report a delay'], ['ACCESS_PROBLEM', 'Access problem'], ['NOTE', 'Add a note']]

export function DriverJobDetail() {
  const { id } = useParams()
  const { data: j, loading, error, reload, setData } = useApi(() => driverApi.job(id), [id])
  const dash = useApi(driverApi.dashboard, [])
  const [modal, setModal] = useState(null)
  const [f, setF] = useState({})
  const [busy, setBusy] = useState(false)
  const [loc, setLoc] = useState('idle')
  const fileRef = useRef(null)
  const share = !!dash.data?.profile.share_location
  useLocationSharing(j || { id }, !!j && LIVE.includes(j.status) && share, setLoc)

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading || !j) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
  const run = async (fn, msg) => { setBusy(true); try { const d = await fn(); if (d?.id) setData(d); toast.success(msg); setModal(null); setF({}) } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) } }
  const next = j.allowed_next.filter((n) => n.value !== 'EXCEPTION_REQUIRES_REVIEW' && n.value !== 'CANCELLED')
  const primary = next[0]
  const canException = j.allowed_next.some((n) => n.value === 'EXCEPTION_REQUIRES_REVIEW')
  const goStatus = (to) => (to === 'COMPLETED' ? setModal('complete') : run(() => driverApi.setStatus(j.id, { status: to, expected_status: j.status }), 'Status updated.'))
  const live = LIVE.includes(j.status)

  return (
    <div className="space-y-5">
      <div><Link to="/driver/jobs" className="text-xs font-semibold text-brand-600">← All jobs</Link><div className="mt-1 flex items-start justify-between gap-3"><div><h1 className="text-2xl font-extrabold">{j.reference}</h1><p className="text-sm text-navy-400">{date(j.move_date)} · {j.time_slot || 'Time TBC'} · {j.service_name}</p></div><StatusBadge status={j.status} /></div></div>

      {j.status === 'DRIVER_ASSIGNED' && !j.acknowledged && (
        <div className="card border-amber-300 bg-amber-50 p-4 dark:bg-amber-500/10"><p className="font-bold">New assignment</p><p className="mb-3 text-sm text-navy-500">Please confirm you have seen this job.</p><Button full loading={busy} onClick={() => run(() => driverApi.acknowledge(j.id), 'Acknowledged.')}>Acknowledge job</Button></div>)}

      {primary && (j.status !== 'DRIVER_ASSIGNED' || j.acknowledged) && (
        <Button size="lg" full loading={busy} icon={primary.value === 'COMPLETED' ? CheckCircle2 : Navigation} onClick={() => goStatus(primary.value)}>{primary.label}</Button>)}
      {next.length > 1 && <div className="flex flex-wrap gap-2">{next.slice(1).map((n) => <Button key={n.value} variant="outline" size="sm" onClick={() => goStatus(n.value)}>{n.label}</Button>)}</div>}

      {live && (
        <div className={clsx('flex items-center gap-3 rounded-2xl p-4 text-sm', share ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-navy-50 dark:bg-navy-800')}>
          <Radio className={clsx('h-5 w-5', share && loc === 'sharing' && 'animate-pulse')} />
          <p>{!share ? <>Location sharing is off. <Link to="/driver/profile" className="font-bold underline">Turn on in profile</Link> to let customers see your progress.</> : loc === 'denied' ? 'Location permission was denied in your browser.' : loc === 'error' ? 'Could not read or send your location.' : loc === 'sharing' ? 'Sharing your location with the customer while this job is live.' : 'Waiting for GPS…'}</p>
        </div>)}

      {j.customer_contact && <Section title="Customer"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{j.customer_contact.name}</p><p className="text-sm text-navy-400">{j.customer_contact.phone}</p></div>{j.customer_contact.phone && <a href={`tel:${j.customer_contact.phone}`} className="btn btn-primary !rounded-full !px-4" aria-label={`Call ${j.customer_contact.name}`}><Phone className="h-4 w-4" />Call</a>}</div></Section>}

      <div className="grid gap-3"><AddressBlock title="Pickup" tone="brand" line1={j.pickup_line1} city={j.pickup_city} pincode={j.pickup_pincode} floor={j.pickup_floor} elevator={j.pickup_elevator} parking={j.pickup_parking} />
        <a className="-mt-1 text-xs font-semibold text-brand-600" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${j.pickup_line1}, ${j.pickup_city} ${j.pickup_pincode || ''}`)}`}>Open pickup in Maps ↗</a>
        <AddressBlock title="Drop" line1={j.drop_line1} city={j.drop_city} pincode={j.drop_pincode} floor={j.drop_floor} elevator={j.drop_elevator} parking={j.drop_parking} />
        <a className="-mt-1 text-xs font-semibold text-brand-600" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${j.drop_line1}, ${j.drop_city} ${j.drop_pincode || ''}`)}`}>Open drop in Maps ↗</a></div>

      {j.special_instructions && <Section title="Special instructions"><p className="text-sm">{j.special_instructions}</p></Section>}
      <Section title="Services"><p className="text-sm">{[j.packing_required && 'Packing', j.loading_required && 'Loading', j.unloading_required && 'Unloading', ...(j.addons || [])].filter(Boolean).join(' · ') || 'Transport only'}</p></Section>
      <Section title="Inventory"><InventoryTable items={j.inventory} /></Section>

      {(live || j.status === 'DRIVER_ASSIGNED') && (
        <Section title="Report from the field"><div className="grid grid-cols-2 gap-2">{EVENT_KINDS.map(([k, l]) => <Button key={k} variant="outline" size="sm" onClick={() => { setF({ kind: k, note: '' }); setModal('event') }}>{l}</Button>)}</div>
          {canException && <Button className="mt-3" full variant="danger" icon={AlertTriangle} onClick={() => setModal('exception')}>Report a problem to admin</Button>}</Section>)}

      {['IN_TRANSIT', 'UNLOADING', 'COMPLETED'].includes(j.status) && (
        <Section title="Delivery proof" action={<Badge tone={j.proof_count ? 'green' : 'slate'}>{j.proof_count} photo(s)</Badge>}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 5 * 1024 * 1024) return toast.error('Photo must be under 5 MB.'); run(() => driverApi.uploadProof(j.id, file, f.proof_note).then(() => driverApi.job(j.id)), 'Proof uploaded.') }} />
          <Button full variant="outline" icon={Camera} loading={busy} onClick={() => fileRef.current?.click()}>Take / upload photo</Button><p className="mt-2 text-xs text-navy-400">JPEG, PNG or WebP, up to 5 MB. Up to 10 photos.</p></Section>)}

      <Section title="Timeline">{j.events.length ? <ul className="space-y-3 text-sm">{j.events.map((e) => <li key={e.id}><b>{e.kind_label}</b> <span className="text-xs text-navy-400">· {dateTime(e.created_at)}</span>{e.note && <p className="text-navy-500">{e.note}</p>}</li>)}</ul> : <p className="text-sm text-navy-400">Nothing recorded yet.</p>}</Section>

      <Modal open={modal === 'event'} onClose={() => setModal(null)} title={EVENT_KINDS.find((k) => k[0] === f.kind)?.[1]} size="sm" footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} icon={Send} onClick={() => run(() => driverApi.addEvent(j.id, f).then(() => driverApi.job(j.id)), 'Recorded.')}>Send</Button></>}>
        <Field label={['DELAY', 'ACCESS_PROBLEM', 'NOTE'].includes(f.kind) ? 'Describe what happened' : 'Note (optional)'}>{(a) => <Textarea {...a} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
        {['DELAY', 'ACCESS_PROBLEM'].includes(f.kind) && <p className="mt-2 text-xs text-navy-400">The customer will be notified.</p>}
      </Modal>
      <Modal open={modal === 'exception'} onClose={() => setModal(null)} title="Report a problem" size="sm" footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => { if (!f.reason?.trim()) return toast.error('Please describe the problem.'); run(() => driverApi.setStatus(j.id, { status: 'EXCEPTION_REQUIRES_REVIEW', reason: f.reason, expected_status: j.status }), 'Admin notified.') }}>Send to admin</Button></>}>
        <Field label="What went wrong?">{(a) => <Textarea {...a} value={f.reason || ''} onChange={(e) => setF({ ...f, reason: e.target.value })} />}</Field></Modal>
      <Modal open={modal === 'complete'} onClose={() => setModal(null)} title="Complete job" size="sm" description={j.proof_count ? `${j.proof_count} proof photo(s) uploaded.` : 'Upload delivery proof first, or add completion notes.'} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={() => run(() => driverApi.setStatus(j.id, { status: 'COMPLETED', completion_note: f.completion_note || '', expected_status: j.status }), 'Job completed. Great work!')}>Mark completed</Button></>}>
        <Field label="Completion notes" hint="Required if no proof photo has been uploaded.">{(a) => <Textarea {...a} value={f.completion_note || ''} onChange={(e) => setF({ ...f, completion_note: e.target.value })} />}</Field></Modal>
    </div>
  )
}

export function DriverProfile() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi(driverApi.dashboard)
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <Skeleton className="h-64" />
  const p = data.profile
  const save = async (body, msg) => { try { await driverApi.updateProfile(body); toast.success(msg); reload(true) } catch (e) { toast.error(errorMessage(e)) } }
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Profile</h1>
      <Section><div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-full bg-brand-500/15 text-brand-600"><UserCircle2 className="h-8 w-8" /></span><div><p className="font-bold">{user.full_name}</p><p className="text-sm text-navy-400">{user.email}</p><p className="text-sm text-navy-400">{user.phone}</p></div></div></Section>
      <Section title="Duty status"><Toggle checked={p.availability === 'AVAILABLE'} onChange={(v) => save({ availability: v ? 'AVAILABLE' : 'OFF_DUTY' }, v ? 'You are available.' : 'You are off duty.')} label="Available for jobs" description={p.availability === 'BUSY' ? 'You are on a job, so this cannot be changed now.' : p.approval !== 'APPROVED' ? 'Available after admin approval.' : 'Turn off when you are not working.'} /></Section>
      <Section title="Location sharing"><Toggle checked={p.share_location} onChange={(v) => save({ share_location: v }, v ? 'Location sharing enabled.' : 'Location sharing disabled.')} label="Share my live location with customers" description="Only while a job is live and this app is open. Customers see your last known position. You can turn this off any time." /></Section>
      <p className="text-center text-xs text-navy-400">Need to change your vehicle or licence details? Contact the admin team.</p>
    </div>
  )
}
