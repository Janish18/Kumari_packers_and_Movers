import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Calculator, CheckCircle2, Info, MapPinned } from 'lucide-react'
import clsx from 'clsx'
import Button from '../common/Button'
import { Field, Input, Select, Toggle } from '../common/Field'
import { AnimatedCounter } from '../animations/Motion'
import { quoteApi } from '../../api/quoteApi'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { coverageOf, useAreas } from '../../hooks/useAreas'
import { useAuth } from '../../features/auth/AuthContext'
import { saveQuoteDraft } from '../../utils/draft'
import { addDays, errorMessage, money, today } from '../../utils/format'
import { toast } from 'sonner'

const schema = z.object({
  pickup_city: z.string().trim().min(2, 'Enter the pickup city'),
  drop_city: z.string().trim().min(2, 'Enter the delivery city'),
  property_type: z.string().min(1, 'Choose a property type'),
  move_date: z.string().min(1, 'Choose a move date').refine((v) => v >= today(), 'Move date cannot be in the past'),
  distance_km: z.union([z.literal(''), z.coerce.number().min(0, 'Cannot be negative').max(5000, 'Too large')]).optional(),
  pickup_floor: z.coerce.number().int().min(0).max(60),
  drop_floor: z.coerce.number().int().min(0).max(60),
  vehicle_category: z.string().optional(),
})

const VEHICLES = [['', 'Let us choose'], ['MINI', 'Mini truck'], ['SMALL', 'Small truck'], ['MEDIUM', 'Medium truck'], ['LARGE', 'Large truck']]
const ADDONS = [['dismantling', 'Furniture dismantling & reassembly'], ['fragile', 'Fragile-item handling'], ['insurance_assist', 'Transit protection handling']]

function CoverageChip({ label, status }) {
  if (!status) return null
  const m = { SERVICEABLE: ['We serve this city', 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300', CheckCircle2], MANUAL: ['Needs manual confirmation', 'text-amber-800 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300', Info], UNKNOWN: ['Not on our list - we will confirm manually', 'text-amber-800 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300', AlertTriangle] }[status]
  const Icon = m[2]
  return <p className={clsx('mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold', m[1])}><Icon className="h-3.5 w-3.5" />{label}: {m[0]}</p>
}

export default function Estimator({ initial }) {
  const { property_types } = useSiteConfig()
  const { areas } = useAreas()
  const { user } = useAuth()
  const nav = useNavigate()
  const [packing, setPacking] = useState(false)
  const [unloading, setUnloading] = useState(true)
  const [pickupElevator, setPE] = useState(true)
  const [dropElevator, setDE] = useState(true)
  const [addons, setAddons] = useState([])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, watch, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { pickup_city: '', drop_city: '', property_type: '', move_date: addDays(7), distance_km: '', pickup_floor: 0, drop_floor: 0, vehicle_category: '', ...initial },
  })
  const pc = watch('pickup_city'), dc = watch('drop_city')
  const pickCov = useMemo(() => coverageOf(areas, pc), [areas, pc])
  const dropCov = useMemo(() => coverageOf(areas, dc), [areas, dc])
  useEffect(() => { setResult(null) }, [packing, unloading, pickupElevator, dropElevator, addons])

  const payload = (v) => ({
    property_type: v.property_type, distance_km: v.distance_km === '' || v.distance_km == null ? null : String(v.distance_km),
    packing, loading: true, unloading, pickup_floor: v.pickup_floor, pickup_elevator: pickupElevator, drop_floor: v.drop_floor, drop_elevator: dropElevator,
    vehicle_category: v.vehicle_category || null, addons,
  })

  const onSubmit = async (v) => {
    setBusy(true); setResult(null)
    try { setResult(await quoteApi.estimate(payload(v))) } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  const requestFormal = () => {
    const v = getValues()
    saveQuoteDraft({ ...v, packing_required: packing, unloading_required: unloading, pickup_elevator: pickupElevator, drop_elevator: dropElevator, addons, distance_km: v.distance_km })
    if (user?.role === 'CUSTOMER') nav('/app/bookings/new')
    else if (user) toast.info('Quotation requests are made from a customer account.')
    else nav('/register?next=%2Fapp%2Fbookings%2Fnew')
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-6 p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Pickup city" required error={errors.pickup_city?.message}>{(a) => <><Input {...a} list="kpm-cities" placeholder="e.g. Chennai" error={errors.pickup_city} {...register('pickup_city')} /><CoverageChip label="Pickup" status={pickCov} /></>}</Field>
          <Field label="Delivery city" required error={errors.drop_city?.message}>{(a) => <><Input {...a} list="kpm-cities" placeholder="e.g. Bengaluru" error={errors.drop_city} {...register('drop_city')} /><CoverageChip label="Delivery" status={dropCov} /></>}</Field>
          <datalist id="kpm-cities">{areas.map((a) => <option key={a.id} value={a.city} />)}</datalist>
          <Field label="Property type" required error={errors.property_type?.message}>{(a) => <Select {...a} error={errors.property_type} {...register('property_type')}><option value="">Select size…</option>{property_types.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>}</Field>
          <Field label="Moving date" required error={errors.move_date?.message}>{(a) => <Input {...a} type="date" min={today()} error={errors.move_date} {...register('move_date')} />}</Field>
          <Field label="Approx. distance (km)" hint="Optional. We don't auto-calculate map distance; enter it if you know it." error={errors.distance_km?.message}>{(a) => <Input {...a} type="number" min="0" step="0.1" inputMode="decimal" placeholder="e.g. 350" error={errors.distance_km} {...register('distance_km')} />}</Field>
          <Field label="Vehicle">{(a) => <Select {...a} {...register('vehicle_category')}>{VEHICLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
        </div>

        <fieldset>
          <legend className="label">Floors &amp; access</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-navy-100 p-4 dark:border-navy-800"><p className="mb-3 text-sm font-bold">Pickup</p>
              <Field label="Floor number">{(a) => <Input {...a} type="number" min="0" max="60" {...register('pickup_floor')} />}</Field>
              <div className="mt-3"><Toggle checked={pickupElevator} onChange={setPE} label="Lift available" /></div></div>
            <div className="rounded-xl border border-navy-100 p-4 dark:border-navy-800"><p className="mb-3 text-sm font-bold">Delivery</p>
              <Field label="Floor number">{(a) => <Input {...a} type="number" min="0" max="60" {...register('drop_floor')} />}</Field>
              <div className="mt-3"><Toggle checked={dropElevator} onChange={setDE} label="Lift available" /></div></div>
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle checked={packing} onChange={setPacking} label="Packing & unpacking" description="Materials and labour" />
          <Toggle checked={unloading} onChange={setUnloading} label="Loading & unloading" description="Helpers at both ends" />
        </div>

        <fieldset>
          <legend className="label">Optional services</legend>
          <div className="flex flex-wrap gap-2">
            {ADDONS.map(([k, l]) => {
              const on = addons.includes(k)
              return <button key={k} type="button" aria-pressed={on} onClick={() => setAddons((a) => (on ? a.filter((x) => x !== k) : [...a, k]))}
                className={clsx('rounded-full border px-4 py-2 text-sm font-semibold transition-all', on ? 'border-brand-500 bg-brand-500 text-white shadow-glow' : 'border-navy-200 hover:border-brand-400 dark:border-navy-700')}>{on ? '✓ ' : '+ '}{l}</button>
            })}
          </div>
        </fieldset>

        <Button type="submit" size="lg" shine loading={busy} icon={Calculator} className="w-full">Calculate my estimate</Button>
      </form>

      <div className="lg:sticky lg:top-28 lg:self-start" aria-live="polite">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card relative overflow-hidden p-8 text-center">
              <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/10 blur-2xl" />
              <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10"><Calculator className="h-8 w-8" /></span>
              <h3 className="relative mt-5 text-xl font-extrabold">Your estimate appears here</h3>
              <p className="relative mt-2 text-sm text-navy-400">Fill in the details and calculate. Estimates use the business's configured rates and are never a confirmed price.</p>
            </motion.div>
          ) : (
            <motion.div key="res" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="card overflow-hidden">
              <div className="noise bg-navy-900 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-300">Estimated cost · not a confirmed quotation</p>
                {result.configured ? (
                  <p className="mt-2 font-display text-4xl font-extrabold sm:text-5xl"><AnimatedCounter value={result.total} format={(v) => money(v, true)} /></p>
                ) : <p className="mt-2 text-lg font-bold">Pricing not configured for this selection</p>}
                {result.configured && Number(result.gst) > 0 && <p className="mt-1 text-xs text-white/60">Includes GST {result.gst_percent}% ({money(result.gst)})</p>}
              </div>
              <div className="p-6">
                {result.configured && (
                  <ul className="divide-y divide-navy-100 text-sm dark:divide-navy-800">
                    {result.lines.map((l, i) => (
                      <motion.li key={l.code + i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex justify-between gap-4 py-2.5"><span>{l.label}</span><span className="font-semibold tabular-nums">{money(l.line_total)}</span></motion.li>
                    ))}
                  </ul>
                )}
                {result.notes?.length > 0 && <ul className="mt-4 space-y-1.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{result.notes.map((n) => <li key={n} className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{n}</li>)}</ul>}
                <p className="mt-4 text-xs text-navy-400">{result.disclaimer}</p>
                <Button onClick={requestFormal} size="lg" shine className="group mt-5 w-full" iconRight={ArrowRight}>Request a formal quotation</Button>
                {!user && <p className="mt-3 text-center text-xs text-navy-400">Free account required · <Link to="/login?next=%2Fapp%2Fbookings%2Fnew" className="font-semibold text-brand-600">I already have one</Link></p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
