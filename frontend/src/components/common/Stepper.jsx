import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

/** Multistep progress indicator with an animated progress bar. */
export default function Stepper({ steps, current }) {
  const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100
  return (
    <nav aria-label="Progress" className="mb-8">
      <div className="relative">
        <div className="absolute left-4 right-4 top-4 h-1 rounded-full bg-navy-100 dark:bg-navy-800" />
        <motion.div className="absolute left-4 top-4 h-1 rounded-full bg-gradient-to-r from-brand-400 to-brand-600" initial={false} animate={{ width: `calc((100% - 2rem) * ${pct / 100})` }} transition={{ type: 'spring', damping: 24, stiffness: 140 }} />
        <ol className="relative flex justify-between">
          {steps.map((s, i) => (
            <li key={s} className="flex w-16 flex-col items-center gap-2 text-center sm:w-24" aria-current={i === current ? 'step' : undefined}>
              <motion.span animate={{ scale: i === current ? 1.15 : 1 }} className={clsx('grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-bold transition-colors',
                i < current ? 'border-brand-500 bg-brand-500 text-white' : i === current ? 'border-brand-500 bg-white text-brand-600 shadow-glow dark:bg-navy-900' : 'border-navy-200 bg-white text-navy-300 dark:border-navy-700 dark:bg-navy-900')}>
                {i < current ? <Check className="h-4 w-4" /> : i + 1}
              </motion.span>
              <span className={clsx('text-[11px] font-semibold leading-tight sm:text-xs', i <= current ? 'text-navy-800 dark:text-white' : 'text-navy-300')}>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}
