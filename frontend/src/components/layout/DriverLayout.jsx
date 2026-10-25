import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Bell, ClipboardList, Home, LogOut, UserCircle2 } from 'lucide-react'
import { LogoMark } from '../common/Logo'
import ThemeToggle from '../common/ThemeToggle'
import { PageTransition } from '../animations/Motion'
import { useAuth } from '../../features/auth/AuthContext'

const TABS = [
  { to: '/driver', label: 'Today', icon: Home, end: true },
  { to: '/driver/jobs', label: 'Jobs', icon: ClipboardList },
  { to: '/driver/notifications', label: 'Alerts', icon: Bell },
  { to: '/driver/profile', label: 'Profile', icon: UserCircle2 },
]

/** Mobile-first shell: sticky top bar + thumb-reachable bottom tab bar. */
export default function DriverLayout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  return (
    <div className="min-h-screen bg-paper pb-24 dark:bg-navy-950">
      <header className="sticky top-0 z-30 bg-navy-900 text-white shadow-glow-navy">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link to="/driver" className="flex items-center gap-2.5"><LogoMark className="h-8 w-8" /><span className="font-display text-sm font-extrabold">Driver app</span></Link>
          <div className="flex items-center gap-1"><span className="hidden text-xs text-white/60 sm:block">{user.full_name}</span><ThemeToggle className="!text-white hover:!bg-white/10" /><button onClick={async () => { await logout(); nav('/login', { replace: true }) }} aria-label="Log out" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10"><LogOut className="h-5 w-5" /></button></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4"><AnimatePresence mode="wait"><PageTransition key={loc.pathname}><Outlet /></PageTransition></AnimatePresence></main>
      <nav aria-label="Driver" className="glass-light pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 dark:border-navy-800">
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} end={t.end} className={({ isActive }) => clsx('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors', isActive ? 'text-brand-600' : 'text-navy-400')}>
                {({ isActive }) => (<>{isActive && <motion.span layoutId="drv-tab" className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-brand-500" />}<t.icon className="h-5 w-5" />{t.label}</>)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
