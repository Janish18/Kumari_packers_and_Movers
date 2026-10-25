import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { EmptyState, ErrorState, Skeleton } from './Feedback'
import Button from './Button'

export function SearchBox({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input pl-10" />
    </div>
  )
}

export function Pagination({ page, count, pageSize = 20, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (count <= pageSize) return null
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-4 text-sm text-navy-500">
      <span>Page {page} of {pages} <span className="hidden sm:inline">· {count} records</span></span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">Prev</Button>
        <Button variant="outline" size="sm" iconRight={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">Next</Button>
      </div>
    </div>
  )
}

/** columns: [{key, header, render?(row), className?, hideOnMobile?}] */
export default function DataTable({ columns, rows, loading, error, onRetry, empty, onRowClick, rowKey = 'id' }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (!loading && !rows?.length) return empty || <EmptyState title="Nothing here yet" />
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-navy-50/80 text-xs uppercase tracking-wide text-navy-400 dark:bg-navy-800/60">
            <tr>{columns.map((c) => <th key={c.key} scope="col" className={clsx('px-4 py-3 font-semibold', c.hideOnMobile && 'hidden md:table-cell', c.className)}>{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <tr key={i}>{columns.map((c) => <td key={c.key} className={clsx('px-4 py-3.5', c.hideOnMobile && 'hidden md:table-cell')}><Skeleton className="h-4 w-full max-w-[140px]" /></td>)}</tr>)
              : rows.map((row, i) => (
                <motion.tr key={row[rowKey]} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined} tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row) } : undefined}
                  className={clsx('transition-colors', onRowClick && 'cursor-pointer hover:bg-brand-50/60 focus-visible:bg-brand-50/60 dark:hover:bg-navy-800/70')}>
                  {columns.map((c) => <td key={c.key} className={clsx('px-4 py-3.5 align-middle', c.hideOnMobile && 'hidden md:table-cell', c.className)}>{c.render ? c.render(row) : row[c.key]}</td>)}
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
