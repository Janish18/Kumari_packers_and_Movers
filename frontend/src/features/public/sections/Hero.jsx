import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, CalendarDays, Home, MapPin, MapPinned, Navigation, Radar, ReceiptText } from 'lucide-react'
import { Aurora, Magnetic, Parallax, SplitHeadline } from '../../../components/animations/Motion'
import TruckScene from '../../../components/animations/TruckScene'
import { AnimatedCounter } from '../../../components/animations/Motion'
import { useSiteConfig } from '../../../hooks/useSiteConfig'
import { saveQuoteDraft } from '../../../utils/draft'
import { addDays, today } from '../../../utils/format'

function HeroQuickForm() {
  const { property_types } = useSiteConfig()
  const nav = useNavigate()
  const [f, setF] = useState({ pickup_city: '', drop_city: '', move_date: addDays(7), property_type: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const go = (e) => {
    e.preventDefault()
    if (f.pickup_city.trim().length < 2 || f.drop_city.trim().length < 2) return setErr('Enter both the pickup and delivery city.')
    if (f.move_date < today()) return setErr('Moving date cannot be in the past.')
    saveQuoteDraft(f)
    nav('/quote')
  }
  const field = 'flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 transition focus-within:border-brand-400 focus-within:bg-white/15'
  const inp = 'w-full bg-transparent text-sm text-white placeholder:text-white/45 outline-none [color-scheme:dark]'
  return (
    <form onSubmit={go} noValidate className="glass relative rounded-3xl p-5 sm:p-6" aria-label="Quick moving estimate">
      <div aria-hidden className="absolute -inset-px -z-10 rounded-3xl bg-gradient-to-br from-brand-500/50 via-transparent to-navy-400/40 blur-sm" />
      <h2 className="font-display text-lg font-bold text-white">Check your moving cost</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={field}><MapPin className="h-4 w-4 shrink-0 text-brand-300" /><span className="sr-only">Pickup city</span><input className={inp} placeholder="Pickup city" value={f.pickup_city} onChange={set('pickup_city')} autoComplete="off" /></label>
        <label className={field}><Navigation className="h-4 w-4 shrink-0 text-brand-300" /><span className="sr-only">Delivery city</span><input className={inp} placeholder="Delivery city" value={f.drop_city} onChange={set('drop_city')} autoComplete="off" /></label>
        <label className={field}><CalendarDays className="h-4 w-4 shrink-0 text-brand-300" /><span className="sr-only">Moving date</span><input type="date" className={inp} min={today()} value={f.move_date} onChange={set('move_date')} /></label>
        <label className={field}><Home className="h-4 w-4 shrink-0 text-brand-300" /><span className="sr-only">Property type</span>
          <select className={`${inp} appearance-none [&>option]:text-navy-900`} value={f.property_type} onChange={set('property_type')}><option value="">Property type</option>{property_types.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
      </div>
      {err && <p role="alert" className="mt-3 animate-shake text-sm font-medium text-amber-300">{err}</p>}
      <button type="submit" className="btn btn-primary btn-lg btn-shine group mt-4 w-full">Get my estimate <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></button>
    </form>
  )
}

const TRUST = [[ReceiptText, 'Itemised quotations'], [Radar, 'Verified status tracking'], [BadgeCheck, 'Consent-based live location']]

export default function Hero() {
  const { config } = useSiteConfig()
  const stats = Array.isArray(config?.stats) ? config.stats.filter((s) => s && s.label && s.value != null) : []
  return (
    <section className="noise relative -mt-[76px] overflow-hidden bg-navy-900 pt-[76px] text-white">
      <Aurora />
      <div aria-hidden className="absolute inset-0 bg-grid-navy [background-size:48px_48px] [mask-image:radial-gradient(75%_65%_at_50%_30%,#000,transparent)]" />
      <div className="container relative grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:py-28">
        <div>
          <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="eyebrow !bg-white/10 !text-brand-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />Residential &amp; office relocation</motion.span>
          <SplitHeadline className="mt-6 font-display text-[2.5rem] font-extrabold leading-[1.05] sm:text-5xl xl:text-[3.5rem] 2xl:text-6xl"
            lines={['Moving Homes.', 'Moving Lives.', { text: 'Moving With Care.', className: 'text-gradient-animated' }]} />
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.7 }} className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            Safe, reliable relocation with an itemised quotation, a dedicated moving team and booking updates you can trust — from the first box to the last.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 0.7 }} className="mt-8 flex flex-wrap gap-4">
            <Magnetic><Link to="/quote" className="btn btn-primary btn-lg btn-shine group">Get a Free Moving Quote <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></Link></Magnetic>
            <Magnetic><Link to="/track" className="btn btn-lg border border-white/25 bg-white/5 text-white backdrop-blur hover:bg-white/15"><MapPinned className="h-5 w-5" />Track Your Booking</Link></Magnetic>
          </motion.div>
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {stats.length > 0
              ? stats.map((s) => <li key={s.label}><p className="font-display text-3xl font-extrabold text-white"><AnimatedCounter value={s.value} format={(v) => `${Math.round(v).toLocaleString('en-IN')}${s.suffix || ''}`} /></p><p className="text-xs text-white/55">{s.label}</p></li>)
              : TRUST.map(([Icon, t]) => <li key={t} className="flex items-center gap-2 text-sm font-semibold text-white/80"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Icon className="h-4 w-4 text-brand-300" /></span>{t}</li>)}
          </motion.ul>
        </div>
        <div className="relative">
          <Parallax speed={0.1}><TruckScene className="mx-auto max-w-xl" /></Parallax>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="-mt-6 sm:-mt-10"><HeroQuickForm /></motion.div>
        </div>
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper to-transparent dark:from-navy-950" />
    </section>
  )
}
