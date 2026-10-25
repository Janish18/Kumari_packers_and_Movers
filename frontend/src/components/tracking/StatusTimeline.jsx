import clsx from 'clsx'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, CircleSlash, Truck } from 'lucide-react'
import { JOURNEY, STATUS, dateTime } from '../../utils/format'

/**
 * Animated booking journey. Only steps that have really happened carry a timestamp (taken from the
 * server-side status history). Nothing here is simulated.
 */
export default function StatusTimeline({ status, history = [], orientation = 'vertical' }) {
  const terminal = ['CANCELLED', 'REJECTED'].includes(status)
  const exception = status === 'EXCEPTION_REQUIRES_REVIEW'
  // The furthest journey step actually reached, from history (works for exception detours too).
  const reached = history.reduce((m, h) => Math.max(m, JOURNEY.indexOf(h.to_status)), -1)
  const current = exception || terminal ? reached : JOURNEY.indexOf(status)
  const stamp = (s) => history.slice().reverse().find((h) => h.to_status === s)
  const pct = JOURNEY.length > 1 ? (Math.max(current, 0) / (JOURNEY.length - 1)) * 100 : 0
  const live = !terminal && !exception && ['EN_ROUTE_TO_PICKUP', 'LOADING', 'IN_TRANSIT', 'UNLOADING'].includes(status)

  if (orientation === 'horizontal') {
    return (
      <div className="relative overflow-x-auto pb-2"><div className="relative min-w-[720px] px-4 pt-2">
        <div className="absolute left-8 right-8 top-[22px] h-1 rounded-full bg-navy-100 dark:bg-navy-800" />
        <motion.div className="absolute left-8 top-[22px] h-1 rounded-full bg-gradient-to-r from-brand-400 to-brand-600" initial={{ width: 0 }} animate={{ width: `calc((100% - 4rem) * ${pct / 100})` }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
        <ol className="relative flex justify-between">
          {JOURNEY.map((s, i) => {
            const done = i < current, active = i === current
            return (
              <li key={s} className="flex w-20 flex-col items-center gap-2 text-center">
                <span className={clsx('relative grid h-10 w-10 place-items-center rounded-full border-2 transition-colors', done ? 'border-brand-500 bg-brand-500 text-white' : active ? 'border-brand-500 bg-white text-brand-600 dark:bg-navy-900' : 'border-navy-200 bg-white text-navy-300 dark:border-navy-700 dark:bg-navy-900')}>
                  {active && !terminal && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/40" />}
                  {done ? <Check className="h-4 w-4" /> : active ? <Truck className="relative h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </span>
                <span className={clsx('text-[11px] font-semibold leading-tight', i <= current ? '' : 'text-navy-300')}>{STATUS[s].label}</span>
              </li>
            )
          })}
        </ol>
      </div></div>
    )
  }

  return (
    <div>
      {(terminal || exception) && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={clsx('mb-5 flex items-start gap-3 rounded-xl p-4 text-sm', terminal ? 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200')}>
          {terminal ? <CircleSlash className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
          <div><p className="font-bold">{STATUS[status].label}</p>{stamp(status)?.reason && <p className="mt-0.5">{stamp(status).reason}</p>}{exception && <p className="mt-0.5">Our team is reviewing this job and will update you.</p>}</div>
        </motion.div>
      )}
      <ol className="relative">
        <div aria-hidden className="absolute bottom-3 left-[15px] top-3 w-0.5 bg-navy-100 dark:bg-navy-800" />
        <motion.div aria-hidden className="absolute left-[15px] top-3 w-0.5 origin-top bg-gradient-to-b from-brand-500 to-brand-400" initial={{ height: 0 }} animate={{ height: `calc((100% - 1.5rem) * ${pct / 100})` }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
        {JOURNEY.map((s, i) => {
          const done = i < current || (i === current && status === 'COMPLETED'), active = i === current && status !== 'COMPLETED', st = stamp(s)
          return (
            <motion.li key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex gap-4 pb-6 last:pb-0">
              <span className={clsx('relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold', done ? 'border-brand-500 bg-brand-500 text-white' : active ? 'border-brand-500 bg-white text-brand-600 dark:bg-navy-900' : 'border-navy-200 bg-white text-navy-300 dark:border-navy-700 dark:bg-navy-900')}>
                {active && live && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/40" />}
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <div className="pt-1"><p className={clsx('text-sm font-bold', i > current && 'text-navy-300')}>{STATUS[s].label}{active && <span className="ml-2 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-600">Current</span>}</p>
                {st && <p className="text-xs text-navy-400">{dateTime(st.created_at)}{st.actor_name ? ` · ${st.actor_name}` : ''}</p>}</div>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}
