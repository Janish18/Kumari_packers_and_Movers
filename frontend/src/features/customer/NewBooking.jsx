import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Camera, ChevronDown, Info, Minus, Plus, Save, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/common/Button'
import { Field, Input, Select, Textarea, Toggle } from '../../components/common/Field'
import Stepper from '../../components/common/Stepper'
import { Badge, ErrorState, Skeleton, SuccessBurst } from '../../components/common/Feedback'
import { PageHeader, Section } from '../../components/common/Layout'
import { bookingApi } from '../../api/bookingApi'
import { authApi } from '../../api/authApi'
import { publicApi } from '../../api/publicApi'
import { quoteApi } from '../../api/quoteApi'
import { useApi } from '../../hooks/useApi'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { coverageOf, useAreas } from '../../hooks/useAreas'
import { clearQuoteDraft, loadQuoteDraft } from '../../utils/draft'
import { addDays, applyFieldErrors, errorMessage, money, today } from '../../utils/format'

const STEPS = ['Move details', 'Addresses', 'Inventory', 'Review']
const ADDONS = [['dismantling', 'Furniture dismantling & reassembly'], ['fragile', 'Fragile-item handling'], ['insurance_assist', 'Transit protection handling']]
const VEHICLES = [['', 'Let the team choose'], ['MINI', 'Mini truck'], ['SMALL', 'Small truck'], ['MEDIUM', 'Medium truck'], ['LARGE', 'Large truck']]

const schema = z.object({
  service: z.coerce.number({ invalid_type_error: 'Choose a service' }).int().positive('Choose a service'),
  property_type: z.string().min(1, 'Choose a property type'),
  move_date: z.string().min(1, 'Choose a move date').refine((v) => v >= today(), 'Move date cannot be in the past'),
  time_slot: z.string().optional(),
  vehicle_category: z.string().optional(),
  distance_km: z.union([z.literal(''), z.coerce.number().min(0).max(5000)]).optional(),
  pickup_line1: z.string().trim().min(3, 'Enter the pickup address'),
  pickup_city: z.string().trim().min(2, 'Enter the pickup city'),
  pickup_pincode: z.string().optional(),
  pickup_floor: z.coerce.number().int().min(0).max(60),
  pickup_parking: z.string().optional(),
  drop_line1: z.string().trim().min(3, 'Enter the delivery address'),
  drop_city: z.string().trim().min(2, 'Enter the delivery city'),
  drop_pincode: z.string().optional(),
  drop_floor: z.coerce.number().int().min(0).max(60),
  drop_parking: z.string().optional(),
  special_instructions: z.string().max(2000).optional(),
})
const STEP_FIELDS = [['service', 'property_type', 'move_date', 'time_slot', 'vehicle_category', 'distance_km'], ['pickup_line1', 'pickup_city', 'pickup_pincode', 'pickup_floor', 'drop_line1', 'drop_city', 'drop_pincode', 'drop_floor'], [], ['special_instructions']]

function CoverageNote({ status }) {
  if (!status) return null
  if (status === 'SERVICEABLE') return <Badge tone="green" className="mt-1.5">On our service list</Badge>
  return <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Not guaranteed. We'll confirm this location manually before accepting your booking.</p>
}

function AddressFields({ prefix, title, errors, register, elevator, setElevator, coverage, saved, onPick }) {
  const e = (k) => errors[`${prefix}_${k}`]?.message
  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{title}</h3>
        {saved?.length > 0 && <select aria-label={`Use a saved address for ${title}`} className="input !w-auto !py-1.5 text-xs" defaultValue="" onChange={(ev) => { const a = saved.find((s) => String(s.id) === ev.target.value); if (a) onPick(a); ev.target.value = '' }}><option value="">Use saved address…</option>{saved.map((a) => <option key={a.id} value={a.id}>{a.label} - {a.line1}</option>)}</select>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address" required error={e('line1')} className="sm:col-span-2">{(a) => <Input {...a} autoComplete="street-address" error={e('line1')} {...register(`${prefix}_line1`)} />}</Field>
        <Field label="City" required error={e('city')}>{(a) => <><Input {...a} list="bk-cities" autoComplete="address-level2" error={e('city')} {...register(`${prefix}_city`)} /><CoverageNote status={coverage} /></>}</Field>
        <Field label="Pincode">{(a) => <Input {...a} autoComplete="postal-code" {...register(`${prefix}_pincode`)} />}</Field>
        <Field label="Floor number" error={e('floor')}>{(a) => <Input {...a} type="number" min="0" max="60" {...register(`${prefix}_floor`)} />}</Field>
        <Field label="Parking / access notes">{(a) => <Input {...a} placeholder="e.g. Narrow lane, truck parks 50 m away" {...register(`${prefix}_parking`)} />}</Field>
        <div className="sm:col-span-2"><Toggle checked={elevator} onChange={setElevator} label="Lift / elevator available" description="Helps us plan labour and floor-access charges" /></div>
      </div>
    </div>
  )
}

function Qty({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-navy-200 p-0.5 dark:border-navy-700">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-navy-100 dark:hover:bg-navy-800"><Minus className="h-3.5 w-3.5" /></button>
      <span aria-live="polite" className="w-6 text-center text-sm font-bold tabular-nums">{value}</span>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(99, value + 1))} className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-white hover:bg-brand-600"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  )
}

export default function NewBooking() {
  const { id } = useParams()
  const editing = !!id
  const nav = useNavigate()
  const { config, property_types } = useSiteConfig()
  const { areas } = useAreas()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [packing, setPacking] = useState(false)
  const [unloading, setUnloading] = useState(true)
  const [pickupElevator, setPE] = useState(true)
  const [dropElevator, setDE] = useState(true)
  const [addons, setAddons] = useState([])
  const [qty, setQty] = useState({})          // master item id -> quantity
  const [custom, setCustom] = useState([])    // free-text items
  const [newItem, setNewItem] = useState({ name: '', room: 'Living Room', quantity: 1, is_fragile: false })
  const [openRoom, setOpenRoom] = useState(null)
  const [photos, setPhotos] = useState([])
  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [formError, setFormError] = useState('')

  const services = useApi(publicApi.services)
  const master = useApi(publicApi.inventoryItems)
  const saved = useApi(() => authApi.addresses.list())
  const existing = useApi(() => bookingApi.get(id), [id], { enabled: editing })

  const { register, handleSubmit, trigger, watch, reset, setValue, setError, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { service: '', property_type: '', move_date: addDays(7), time_slot: '', vehicle_category: '', distance_km: '', pickup_line1: '', pickup_city: '', pickup_pincode: '', pickup_floor: 0, pickup_parking: '', drop_line1: '', drop_city: '', drop_pincode: '', drop_floor: 0, drop_parking: '', special_instructions: '' },
  })

  // Prefill from the public estimator (new bookings only)
  useEffect(() => {
    if (editing) return
    const d = loadQuoteDraft()
    if (!d) return
    ;['pickup_city', 'drop_city', 'move_date', 'property_type', 'pickup_floor', 'drop_floor', 'vehicle_category'].forEach((k) => { if (d[k] !== undefined && d[k] !== '') setValue(k, d[k]) })
    if (d.distance_km) setValue('distance_km', d.distance_km)
    if (typeof d.packing === 'boolean') setPacking(d.packing); if (typeof d.packing_required === 'boolean') setPacking(d.packing_required)
    if (typeof d.unloading === 'boolean') setUnloading(d.unloading); if (typeof d.unloading_required === 'boolean') setUnloading(d.unloading_required)
    if (typeof d.pickup_elevator === 'boolean') setPE(d.pickup_elevator); if (typeof d.drop_elevator === 'boolean') setDE(d.drop_elevator)
    if (Array.isArray(d.addons)) setAddons(d.addons)
  }, [editing, setValue])

  // Load an existing draft for editing
  useEffect(() => {
    const b = existing.data
    if (!b) return
    reset({ service: b.service, property_type: b.property_type, move_date: b.move_date, time_slot: b.time_slot || '', vehicle_category: b.vehicle_category || '', distance_km: b.distance_km ?? '',
      pickup_line1: b.pickup_line1, pickup_city: b.pickup_city, pickup_pincode: b.pickup_pincode || '', pickup_floor: b.pickup_floor, pickup_parking: b.pickup_parking || '',
      drop_line1: b.drop_line1, drop_city: b.drop_city, drop_pincode: b.drop_pincode || '', drop_floor: b.drop_floor, drop_parking: b.drop_parking || '', special_instructions: b.special_instructions || '' })
    setPacking(b.packing_required); setUnloading(b.unloading_required); setPE(b.pickup_elevator); setDE(b.drop_elevator); setAddons(b.addons || [])
    const q = {}, c = []
    b.inventory.forEach((i) => { if (i.item) q[i.item] = (q[i.item] || 0) + i.quantity; else c.push({ name: i.name, room: i.room, quantity: i.quantity, is_fragile: i.is_fragile }) })
    setQty(q); setCustom(c)
  }, [existing.data, reset])

  const v = watch()
  const pickCov = useMemo(() => coverageOf(areas, v.pickup_city), [areas, v.pickup_city])
  const dropCov = useMemo(() => coverageOf(areas, v.drop_city), [areas, v.drop_city])
  const rooms = useMemo(() => (master.data || []).reduce((m, i) => ({ ...m, [i.room]: [...(m[i.room] || []), i] }), {}), [master.data])
  const roomNames = Object.keys(rooms)
  const slots = Array.isArray(config?.time_slots) ? config.time_slots : []

  const inventory = useMemo(() => {
    const fromMaster = (master.data || []).filter((i) => qty[i.id] > 0).map((i) => ({ item: i.id, name: i.name, room: i.room, quantity: qty[i.id], is_fragile: i.is_fragile }))
    return [...fromMaster, ...custom]
  }, [master.data, qty, custom])
  const itemCount = inventory.reduce((n, i) => n + i.quantity, 0)

  const payload = (submit) => {
    const x = getValues()
    return { service: Number(x.service), property_type: x.property_type, move_date: x.move_date, time_slot: x.time_slot || '', packing_required: packing, loading_required: true, unloading_required: unloading,
      addons, vehicle_category: x.vehicle_category || '', distance_km: x.distance_km === '' || x.distance_km == null ? null : String(x.distance_km),
      pickup_line1: x.pickup_line1, pickup_city: x.pickup_city, pickup_pincode: x.pickup_pincode || '', pickup_floor: Number(x.pickup_floor) || 0, pickup_elevator: pickupElevator, pickup_parking: x.pickup_parking || '',
      drop_line1: x.drop_line1, drop_city: x.drop_city, drop_pincode: x.drop_pincode || '', drop_floor: Number(x.drop_floor) || 0, drop_elevator: dropElevator, drop_parking: x.drop_parking || '',
      special_instructions: x.special_instructions || '', inventory, submit: false }
  }

  const go = async (n) => {
    if (n > step) { const ok = await trigger(STEP_FIELDS[step]); if (!ok) { toast.error('Please fix the highlighted fields.'); return } }
    setDir(n > step ? 1 : -1); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (step !== 3) return
    let on = true
    setEstimating(true)
    const x = getValues()
    quoteApi.estimate({ property_type: x.property_type, distance_km: x.distance_km === '' ? null : String(x.distance_km), packing, loading: true, unloading, pickup_floor: Number(x.pickup_floor) || 0, pickup_elevator: pickupElevator, drop_floor: Number(x.drop_floor) || 0, drop_elevator: dropElevator, vehicle_category: x.vehicle_category || null, addons })
      .then((r) => on && setEstimate(r)).catch(() => on && setEstimate(null)).finally(() => on && setEstimating(false))
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const addCustom = () => {
    if (newItem.name.trim().length < 2) return toast.error('Enter an item name.')
    setCustom((c) => [...c, { ...newItem, name: newItem.name.trim() }]); setNewItem((n) => ({ ...n, name: '', quantity: 1, is_fragile: false }))
  }
  const addPhotos = (files) => {
    const ok = [...files].filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024)
    if (ok.length < files.length) toast.warning('Only JPEG, PNG or WebP images up to 5 MB are accepted.')
    setPhotos((p) => [...p, ...ok].slice(0, 12))
  }

  const save = async (submit) => {
    setBusy(true); setFormError('')
    try {
      const body = payload(false)
      let b = editing ? await bookingApi.update(id, body) : await bookingApi.create(body)
      let failed = 0
      for (const f of photos) { try { await bookingApi.uploadPhoto(b.id, f) } catch { failed++ } }
      if (failed) toast.warning(`${failed} photo(s) could not be uploaded.`)
      if (submit) b = await bookingApi.submit(b.id)
      clearQuoteDraft()
      setDone({ b, submitted: submit })
    } catch (e) {
      if (!applyFieldErrors(e, setError)) setFormError(errorMessage(e)); else { toast.error('Please review the highlighted fields.'); setStep(0) }
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg"><div className="card"><SuccessBurst title={done.submitted ? 'Quotation requested!' : 'Draft saved'} text={done.submitted ? `Your booking reference is ${done.b.reference}. Our team will prepare an itemised quotation and notify you.` : `Your draft ${done.b.reference} is saved. Submit it when you're ready.`}>
        <div className="flex flex-wrap justify-center gap-3"><Link to={`/app/bookings/${done.b.id}`} className="btn btn-primary btn-shine">View booking</Link><Link to="/app" className="btn btn-outline">Dashboard</Link></div></SuccessBurst></div></div>
    )
  }
  if (editing && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />
  if (editing && existing.loading) return <Skeleton className="h-96 w-full" />
  if (editing && existing.data && existing.data.status !== 'DRAFT') return <ErrorState title="This booking can't be edited" error={{ response: { data: { error: { message: 'Only draft bookings can be edited. You can cancel or reschedule instead.' } } } }} />

  const variants = { enter: (d) => ({ opacity: 0, x: d * 40 }), center: { opacity: 1, x: 0 }, exit: (d) => ({ opacity: 0, x: d * -40 }) }
  const svc = services.data?.find((s) => s.id === Number(v.service))

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={editing ? 'Edit draft booking' : 'New booking'} subtitle="Tell us about your move. You review everything before requesting a quotation." breadcrumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'Bookings', to: '/app/bookings' }, { label: editing ? 'Edit' : 'New' }]} />
      <Stepper steps={STEPS} current={step} />
      <datalist id="bk-cities">{areas.map((a) => <option key={a.id} value={a.city} />)}</datalist>
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeOut' }} className="space-y-5">
          {step === 0 && (<>
            <Section title="What are you moving?">
              {services.error ? <ErrorState error={services.error} onRetry={services.reload} /> : (
                <>
                  <fieldset><legend className="label">Service *</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(services.data || []).map((s) => { const on = Number(v.service) === s.id; return (
                        <label key={s.id} className={clsx('relative cursor-pointer rounded-xl border-2 p-4 transition-all', on ? 'border-brand-500 bg-brand-50 shadow-glow dark:bg-brand-500/10' : 'border-navy-100 hover:border-brand-300 dark:border-navy-800')}>
                          <input type="radio" value={s.id} className="sr-only" {...register('service')} /><p className="font-bold">{s.name}</p><p className="mt-0.5 text-xs text-navy-400">{s.summary}</p>
                          {on && <motion.span layoutId="svc-check" className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-white"><ArrowRight className="h-3 w-3 -rotate-45" /></motion.span>}
                        </label>) })}
                    </div>
                    {errors.service && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{errors.service.message}</p>}
                  </fieldset>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Property type" required error={errors.property_type?.message}>{(a) => <Select {...a} error={errors.property_type} {...register('property_type')}><option value="">Select size…</option>{property_types.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>}</Field>
                    <Field label="Move date" required error={errors.move_date?.message}>{(a) => <Input {...a} type="date" min={today()} error={errors.move_date} {...register('move_date')} />}</Field>
                    <Field label="Preferred time slot">{(a) => slots.length ? <Select {...a} {...register('time_slot')}><option value="">No preference</option>{slots.map((s) => <option key={s} value={s}>{s}</option>)}</Select> : <Input {...a} placeholder="e.g. Morning" {...register('time_slot')} />}</Field>
                    <Field label="Vehicle preference">{(a) => <Select {...a} {...register('vehicle_category')}>{VEHICLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
                    <Field label="Approx. distance (km)" hint="Optional. Helps us estimate distance charges." error={errors.distance_km?.message} className="sm:col-span-2">{(a) => <Input {...a} type="number" min="0" step="0.1" inputMode="decimal" {...register('distance_km')} />}</Field>
                  </div>
                </>)}
            </Section>
            <Section title="Services needed">
              <div className="grid gap-3 sm:grid-cols-2"><Toggle checked={packing} onChange={setPacking} label="Packing & unpacking" description="Materials and labour" /><Toggle checked={unloading} onChange={setUnloading} label="Loading & unloading" description="Helpers at pickup and delivery" /></div>
              <div className="mt-4 flex flex-wrap gap-2">{ADDONS.map(([k, l]) => { const on = addons.includes(k); return <button key={k} type="button" aria-pressed={on} onClick={() => setAddons((a) => (on ? a.filter((x) => x !== k) : [...a, k]))} className={clsx('rounded-full border px-4 py-2 text-sm font-semibold transition-all', on ? 'border-brand-500 bg-brand-500 text-white shadow-glow' : 'border-navy-200 hover:border-brand-400 dark:border-navy-700')}>{on ? '✓ ' : '+ '}{l}</button> })}</div>
            </Section>
          </>)}

          {step === 1 && (<>
            <AddressFields prefix="pickup" title="Pickup address" errors={errors} register={register} elevator={pickupElevator} setElevator={setPE} coverage={pickCov} saved={saved.data} onPick={(a) => { setValue('pickup_line1', a.line1); setValue('pickup_city', a.city); setValue('pickup_pincode', a.pincode || '') }} />
            <AddressFields prefix="drop" title="Delivery address" errors={errors} register={register} elevator={dropElevator} setElevator={setDE} coverage={dropCov} saved={saved.data} onPick={(a) => { setValue('drop_line1', a.line1); setValue('drop_city', a.city); setValue('drop_pincode', a.pincode || '') }} />
          </>)}

          {step === 2 && (<>
            <Section title="Room-by-room inventory" action={<Badge tone="orange">{itemCount} item{itemCount === 1 ? '' : 's'}</Badge>}>
              <p className="mb-4 text-sm text-navy-400">Optional but helps us price accurately and brief the team. Tap + to add items.</p>
              {master.loading ? <Skeleton className="h-40 w-full" /> : master.error ? <ErrorState error={master.error} onRetry={master.reload} /> : (
                <div className="space-y-3">{roomNames.map((room) => { const count = rooms[room].reduce((n, i) => n + (qty[i.id] || 0), 0), open = openRoom === room; return (
                  <div key={room} className="overflow-hidden rounded-xl border border-navy-100 dark:border-navy-800">
                    <button type="button" aria-expanded={open} onClick={() => setOpenRoom(open ? null : room)} className="flex w-full items-center justify-between px-4 py-3 text-left font-bold hover:bg-navy-50 dark:hover:bg-navy-800/60"><span>{room}{count > 0 && <Badge tone="orange" className="ml-2">{count}</Badge>}</span><ChevronDown className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')} /></button>
                    <AnimatePresence initial={false}>{open && <motion.ul initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="divide-y divide-navy-100 overflow-hidden dark:divide-navy-800">{rooms[room].map((i) => <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span>{i.name}{i.is_fragile && <Badge tone="amber" className="ml-2">Fragile</Badge>}</span><Qty label={i.name} value={qty[i.id] || 0} onChange={(n) => setQty((q) => ({ ...q, [i.id]: n }))} /></li>)}</motion.ul>}</AnimatePresence>
                  </div>) })}</div>)}
              <div className="mt-6 rounded-xl bg-navy-50 p-4 dark:bg-navy-800/60"><p className="mb-3 text-sm font-bold">Add something that isn't listed</p>
                <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_auto_auto]"><Input aria-label="Item name" placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                  <Select aria-label="Room" value={newItem.room} onChange={(e) => setNewItem({ ...newItem, room: e.target.value })}>{[...new Set([...roomNames, 'Other'])].map((r) => <option key={r}>{r}</option>)}</Select>
                  <Qty label="custom item" value={newItem.quantity} onChange={(n) => setNewItem({ ...newItem, quantity: Math.max(1, n) })} />
                  <Button variant="navy" icon={Plus} onClick={addCustom}>Add</Button></div>
                <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={newItem.is_fragile} onChange={(e) => setNewItem({ ...newItem, is_fragile: e.target.checked })} className="h-4 w-4 accent-brand-500" />Fragile</label>
                {custom.length > 0 && <ul className="mt-3 space-y-1.5">{custom.map((c, i) => <li key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm dark:bg-navy-900"><span>{c.name} <span className="text-navy-400">· {c.room} · ×{c.quantity}</span>{c.is_fragile && <Badge tone="amber" className="ml-2">Fragile</Badge>}</span><button type="button" aria-label={`Remove ${c.name}`} onClick={() => setCustom((x) => x.filter((_, k) => k !== i))} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
              </div>
            </Section>
            <Section title="Item photographs (optional)">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-navy-200 p-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-navy-700"><Camera className="h-7 w-7 text-brand-500" /><span className="text-sm font-semibold">Click to add photos</span><span className="text-xs text-navy-400">JPEG, PNG or WebP · up to 5 MB each · max 12</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} /></label>
              {photos.length > 0 && <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">{photos.map((f, i) => <li key={i} className="group relative aspect-square overflow-hidden rounded-xl bg-navy-100"><img src={URL.createObjectURL(f)} alt={`Selected item ${i + 1}`} className="h-full w-full object-cover" /><button type="button" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-navy-900/80 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"><X className="h-3.5 w-3.5" /></button></li>)}</ul>}
            </Section>
          </>)}

          {step === 3 && (<>
            <Section title="Review your request">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {[['Service', svc?.name], ['Property', property_types.find((p) => p.value === v.property_type)?.label], ['Move date', `${v.move_date}${v.time_slot ? ` · ${v.time_slot}` : ''}`], ['Packing', packing ? 'Yes' : 'No'], ['Loading / unloading', unloading ? 'Both ends' : 'Loading only'], ['Add-ons', addons.length ? addons.join(', ') : 'None'],
                  ['Pickup', `${v.pickup_line1}, ${v.pickup_city} · floor ${v.pickup_floor}, ${pickupElevator ? 'lift' : 'no lift'}`], ['Delivery', `${v.drop_line1}, ${v.drop_city} · floor ${v.drop_floor}, ${dropElevator ? 'lift' : 'no lift'}`], ['Inventory', `${itemCount} items`], ['Photos', `${photos.length} attached`]].map(([k, val]) => <div key={k}><dt className="text-xs font-bold uppercase tracking-wide text-navy-400">{k}</dt><dd className="mt-0.5 font-medium">{val || '-'}</dd></div>)}
              </dl>
              <Field label="Special instructions" className="mt-5">{(a) => <Textarea {...a} placeholder="Anything the team should know: fragile antiques, building rules, preferred contact time…" {...register('special_instructions')} />}</Field>
              {(pickCov !== 'SERVICEABLE' || dropCov !== 'SERVICEABLE') && <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><Info className="mt-0.5 h-4 w-4 shrink-0" />One or both locations need manual confirmation. We'll tell you whether we can serve this route when we prepare your quotation.</p>}
            </Section>
            <Section title="Estimated cost">
              {estimating ? <Skeleton className="h-24 w-full" /> : estimate?.configured ? (<>
                <p className="font-display text-4xl font-extrabold text-brand-600">{money(estimate.total, true)}</p>
                <ul className="mt-3 divide-y divide-navy-100 text-sm dark:divide-navy-800">{estimate.lines.map((l, i) => <li key={i} className="flex justify-between py-2"><span>{l.label}</span><span className="tabular-nums">{money(l.line_total)}</span></li>)}</ul>
                {estimate.notes?.map((n) => <p key={n} className="mt-2 text-xs text-navy-400">• {n}</p>)}
              </>) : <p className="text-sm text-navy-400">{estimate?.notes?.[0] || 'An estimate is not available for these details. Our team will price your move manually in the quotation.'}</p>}
              <p className="mt-4 rounded-lg bg-navy-50 p-3 text-xs text-navy-500 dark:bg-navy-800">This is an estimate only. Your final, itemised quotation is prepared by our team and becomes binding only after you accept it.</p>
            </Section>
            {formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</div>}
          </>)}
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-0 -mx-4 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 bg-paper/90 px-4 py-4 backdrop-blur dark:border-navy-800 dark:bg-navy-950/90 sm:mx-0 sm:rounded-2xl sm:border">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => go(step - 1)} disabled={step === 0 || busy}>Back</Button>
        <div className="flex flex-wrap gap-3">
          {step === 3 && <Button variant="outline" icon={Save} loading={busy} onClick={() => save(false)}>Save as draft</Button>}
          {step < 3 ? <Button iconRight={ArrowRight} className="group" onClick={() => go(step + 1)}>Continue</Button> : <Button shine icon={Send} loading={busy} onClick={() => save(true)}>Request quotation</Button>}
        </div>
      </div>
    </div>
  )
}
