import { motion, useReducedMotion } from 'framer-motion'
import { MapPin, Navigation } from 'lucide-react'

/** Decorative origin→destination route. Purely illustrative: carries NO location data and says so to assistive tech. */
export default function RouteArt({ from = 'Pickup', to = 'Delivery', className = '' }) {
  const reduce = useReducedMotion()
  const path = 'M 40 120 C 140 20, 220 200, 320 90 S 460 60, 520 110'
  return (
    <div className={`relative ${className}`} role="img" aria-label={`Illustration of a route from ${from} to ${to}`}>
      <svg viewBox="0 0 560 190" className="h-auto w-full overflow-visible">
        <path d={path} fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="8" strokeLinecap="round" />
        <motion.path d={path} fill="none" stroke="#FF6B35" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 14" className={reduce ? '' : 'animate-dash-flow'} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2, ease: 'easeInOut' }} />
        {!reduce && (
          <motion.circle r="7" fill="#FF6B35" style={{ offsetPath: `path('${path}')` }} initial={{ offsetDistance: '0%' }} animate={{ offsetDistance: '100%' }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} />
        )}
      </svg>
      <div className="absolute left-0 top-[52%] flex -translate-y-1/2 flex-col items-center"><span className="relative grid h-9 w-9 place-items-center rounded-full bg-navy-900 text-white"><span className="absolute inset-0 animate-pulse-ring rounded-full bg-navy-500/50" /><MapPin className="relative h-4 w-4" /></span><span className="mt-1 text-xs font-bold">{from}</span></div>
      <div className="absolute right-0 top-[50%] flex -translate-y-1/2 flex-col items-center"><span className="relative grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white"><span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/50" /><Navigation className="relative h-4 w-4" /></span><span className="mt-1 text-xs font-bold">{to}</span></div>
    </div>
  )
}
