import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Info, MapPin, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState, Skeleton } from '../../../components/common/Feedback'
import { Reveal } from '../../../components/animations/Motion'
import RouteArt from '../../../components/animations/RouteArt'
import { coverageOf, useAreas } from '../../../hooks/useAreas'

function RouteChecker({ areas }) {
  const [a, setA] = useState(''), [b, setB] = useState('')
  const ca = coverageOf(areas, a), cb = coverageOf(areas, b)
  const verdict = !ca || !cb ? null : ca === 'SERVICEABLE' && cb === 'SERVICEABLE' ? 'ok' : 'manual'
  return (
    <div className="card p-6">
      <h3 className="text-lg font-bold">Check route availability</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="input" list="loc-cities" placeholder="From city" value={a} onChange={(e) => setA(e.target.value)} aria-label="From city" />
        <input className="input" list="loc-cities" placeholder="To city" value={b} onChange={(e) => setB(e.target.value)} aria-label="To city" />
      </div>
      <datalist id="loc-cities">{areas.map((x) => <option key={x.id} value={x.city} />)}</datalist>
      <div aria-live="polite" className="mt-4 min-h-[3.5rem]">
        <AnimatePresence mode="wait">
          {verdict === 'ok' && <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>Both cities are on our service list. Request a quote to confirm your date.</span></motion.div>}
          {verdict === 'manual' && <motion.div key="m" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><Info className="mt-0.5 h-5 w-5 shrink-0" /><span>This route is not guaranteed. We will check it manually after you request a quote, and we won't confirm it until we can serve it.</span></motion.div>}
        </AnimatePresence>
      </div>
      <Link to="/quote" className="btn btn-primary mt-2 w-full">Request a quote <ArrowRight className="h-4 w-4" /></Link>
    </div>
  )
}

export default function Locations() {
  const { areas, loading } = useAreas()
  const [q, setQ] = useState('')
  const shown = useMemo(() => areas.filter((a) => `${a.city} ${a.state}`.toLowerCase().includes(q.trim().toLowerCase())), [areas, q])
  return (
    <section id="locations" className="section bg-white dark:bg-navy-900/40">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center"><span className="eyebrow">Service areas</span><h2 className="h-section mt-4">Where we <span className="text-gradient">move you</span></h2><p className="mt-4 text-navy-400">Search our service list. Anywhere not listed needs manual confirmation, and we never promise a route we can't serve.</p></Reveal>
        <Reveal className="mx-auto mt-10 max-w-3xl text-navy-300"><RouteArt from="Your home" to="New home" /></Reveal>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" /><input type="search" className="input pl-11" placeholder="Search a city or state" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search service areas" /></div>
            <div className="mt-5">
              {loading ? <div className="flex flex-wrap gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 w-32 rounded-full" />)}</div>
                : !areas.length ? <EmptyState icon={MapPin} title="Service areas not published yet" text="Contact us to confirm whether we can serve your route." />
                  : !shown.length ? <p className="rounded-xl border border-dashed border-navy-200 p-6 text-center text-sm text-navy-400 dark:border-navy-700">No match for “{q}”. Request a quote and we'll confirm manually.</p>
                    : <motion.ul layout className="flex flex-wrap gap-3">
                      <AnimatePresence>{shown.map((a) => (
                        <motion.li layout key={a.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} whileHover={{ y: -3 }} className="card flex items-center gap-2.5 rounded-full px-4 py-2.5">
                          <MapPin className="h-4 w-4 text-brand-500" /><span className="text-sm font-semibold">{a.city}{a.state ? `, ${a.state}` : ''}</span>
                          {a.coverage === 'MANUAL' && <Badge tone="amber">Confirm manually</Badge>}
                        </motion.li>))}</AnimatePresence></motion.ul>}
            </div>
          </div>
          <RouteChecker areas={areas} />
        </div>
      </div>
    </section>
  )
}
