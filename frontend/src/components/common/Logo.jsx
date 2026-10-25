import { Link } from 'react-router-dom'
import clsx from 'clsx'

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={clsx('h-10 w-10', className)} aria-hidden>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8453" /><stop offset="1" stopColor="#FF6B35" /></linearGradient></defs>
      <rect width="48" height="48" rx="13" fill="#101B36" />
      <path d="M9 29h18V15H9z" fill="url(#lg)" /><path d="M27 20h7l6 6v3H27z" fill="#fff" opacity=".95" />
      <circle cx="17" cy="32" r="4" fill="#fff" /><circle cx="34" cy="32" r="4" fill="#fff" />
      <circle cx="17" cy="32" r="1.6" fill="#101B36" /><circle cx="34" cy="32" r="1.6" fill="#101B36" />
    </svg>
  )
}

export default function Logo({ to = '/', light = false, compact = false }) {
  return (
    <Link to={to} className="group flex items-center gap-3" aria-label="Kumari Packers and Movers home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      {!compact && (
        <span className="leading-none">
          <span className={clsx('block font-display text-lg font-extrabold tracking-tight', light ? 'text-white' : 'text-navy-900 dark:text-white')}>Kumari</span>
          <span className={clsx('mt-0.5 block text-[10px] font-bold uppercase tracking-[0.22em]', light ? 'text-brand-300' : 'text-brand-500')}>Packers &amp; Movers</span>
        </span>
      )}
    </Link>
  )
}
