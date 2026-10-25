import clsx from 'clsx'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Inbox, Loader2, RefreshCw } from 'lucide-react'
import Button from './Button'
import { errorMessage } from '../../utils/format'

export function Spinner({ className }) { return <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-500', className)} aria-label="Loading" /> }

export function Skeleton({ className }) { return <div className={clsx('skeleton', className)} aria-hidden /> }

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 p-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
          <Skeleton className="hidden h-6 w-20 sm:block" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center rounded-2xl border border-dashed border-navy-200 px-6 py-14 text-center dark:border-navy-700">
      <div className="relative mb-4">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/20" />
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10"><Icon className="h-6 w-6" /></span>
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-navy-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

export function ErrorState({ error, onRetry, title = 'We could not load this' }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-500/30 dark:bg-red-500/10">
      <AlertTriangle className="mb-3 h-8 w-8 text-red-500" />
      <h3 className="font-bold text-red-700 dark:text-red-300">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-red-600/90 dark:text-red-300/80">{errorMessage(error)}</p>
      {onRetry && <Button variant="outline" size="sm" icon={RefreshCw} className="mt-4" onClick={() => onRetry()}>Try again</Button>}
    </div>
  )
}

/** Animated success tick with a small confetti burst. */
export function SuccessBurst({ title, text, children }) {
  const colors = ['bg-brand-500', 'bg-amber-400', 'bg-navy-500', 'bg-emerald-400', 'bg-sky-400']
  return (
    <div className="relative flex flex-col items-center px-4 py-8 text-center">
      <div className="relative">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className={clsx('absolute left-1/2 top-1/2 h-2 w-2 animate-confetti rounded-sm', colors[i % colors.length])}
            style={{ transform: `translate(${Math.cos(i) * 60}px, ${Math.sin(i) * 40 - 20}px)`, animationDelay: `${i * 40}ms` }} />
        ))}
        <span className="grid h-20 w-20 animate-pop-check place-items-center rounded-full bg-emerald-500 text-white shadow-[0_12px_40px_-8px_rgba(16,185,129,.7)]"><CheckCircle2 className="h-10 w-10" /></span>
      </div>
      <h3 className="mt-5 text-2xl font-extrabold">{title}</h3>
      {text && <p className="mt-2 max-w-sm text-sm text-navy-400">{text}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30',
  orange: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
}
export function Badge({ tone = 'slate', dot = false, children, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" /></span>}
      {children}
    </span>
  )
}
