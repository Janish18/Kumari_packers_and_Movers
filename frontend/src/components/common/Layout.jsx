import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

export function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumbs && (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-navy-400">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {b.to ? <Link to={b.to} className="hover:text-brand-600">{b.label}</Link> : <span aria-current="page" className="font-semibold text-navy-600 dark:text-navy-200">{b.label}</span>}
                {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden />}
              </span>
            ))}
          </nav>
        )}
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-extrabold sm:text-3xl">{title}</motion.h1>
        {subtitle && <p className="mt-1 text-sm text-navy-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={clsx('scrollbar-hide flex gap-1 overflow-x-auto rounded-xl bg-navy-100/70 p-1 dark:bg-navy-800', className)}>
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={clsx('relative whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors', value === t.value ? 'text-navy-900 dark:text-white' : 'text-navy-400 hover:text-navy-700 dark:hover:text-navy-100')}>
          {value === t.value && <motion.span layoutId={`tab-${tabs[0].value}`} className="absolute inset-0 rounded-lg bg-white shadow-soft dark:bg-navy-700" transition={{ type: 'spring', damping: 28, stiffness: 380 }} />}
          <span className="relative">{t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-brand-500/15 px-1.5 text-xs text-brand-600">{t.count}</span>}</span>
        </button>
      ))}
    </div>
  )
}

export function Card({ className, children, hover = false, ...p }) {
  return <div className={clsx('card', hover && 'card-hover', className)} {...p}>{children}</div>
}

export function Section({ title, action, children, className }) {
  return (
    <section className={clsx('card p-5 sm:p-6', className)}>
      {(title || action) && <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-bold">{title}</h2>{action}</div>}
      {children}
    </section>
  )
}

export function KeyValue({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k}><dt className="text-xs font-semibold uppercase tracking-wide text-navy-400">{k}</dt><dd className="mt-0.5 break-words text-sm font-medium">{v ?? '-'}</dd></div>
      ))}
    </dl>
  )
}
