import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { Bell, ChevronsLeft, LogOut, Menu } from 'lucide-react'
import Logo, { LogoMark } from '../common/Logo'
import ThemeToggle from '../common/ThemeToggle'
import { Drawer } from '../common/Modal'
import { PageTransition } from '../animations/Motion'
import { useAuth } from '../../features/auth/AuthContext'
import { bookingApi } from '../../api/bookingApi'
import { initials, timeAgo } from '../../utils/format'
import { Skeleton } from '../common/Feedback'

function Sidebar({ items, collapsed, onNavigate }) {
  return (
    <nav aria-label="Dashboard" className="space-y-1">
      {items.map((it, i) => (
        <motion.div key={it.to} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
          {it.section && !collapsed && <p className="mb-1 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{it.section}</p>}
          <NavLink to={it.to} end={it.end} onClick={onNavigate} title={collapsed ? it.label : undefined}
            className={({ isActive }) => clsx('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors', isActive ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 shadow-glow" transition={{ type: 'spring', damping: 28, stiffness: 340 }} />}
                <it.icon className="relative h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                {!collapsed && <span className="relative truncate">{it.label}</span>}
                {!collapsed && it.badge ? <span className="relative ml-auto rounded-full bg-white/15 px-2 text-[11px]">{it.badge}</span> : null}
              </>
            )}
          </NavLink>
        </motion.div>
      ))}
    </nav>
  )
}

function Bell_() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ loading: true, items: [], unread: 0 })
  const nav = useNavigate()
  const { user } = useAuth()
  const load = async () => {
    try {
      const r = await bookingApi.notifications({ page_size: 8 })
      const unread = (await bookingApi.notifications({ is_read: false, page_size: 1 })).count
      setState({ loading: false, items: r.results, unread })
    } catch { setState((s) => ({ ...s, loading: false })) }
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [])
  const base = { CUSTOMER: '/app', ADMIN: '/admin', DRIVER: '/driver' }[user.role]
  const open_ = (n) => { bookingApi.markRead(n.id).catch(() => {}); setOpen(false); if (n.booking) nav(user.role === 'ADMIN' ? `/admin/bookings/${n.booking}` : user.role === 'DRIVER' ? `/driver/jobs/${n.booking}` : `/app/bookings/${n.booking}`); load() }
  return (
    <>
      <button onClick={() => { setOpen(true); load() }} aria-label={`Notifications${state.unread ? `, ${state.unread} unread` : ''}`} className="relative grid h-10 w-10 place-items-center rounded-xl text-navy-600 transition hover:bg-navy-100/70 dark:text-navy-100 dark:hover:bg-navy-800">
        <Bell className={clsx('h-5 w-5', state.unread > 0 && 'origin-top animate-wiggle')} />
        {state.unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">{state.unread > 9 ? '9+' : state.unread}</span>}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Notifications">
        {state.loading ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : !state.items.length ? <p className="p-8 text-center text-sm text-navy-400">You're all caught up.</p>
            : <ul className="divide-y divide-navy-100 dark:divide-navy-800">{state.items.map((n) => (
              <li key={n.id}><button onClick={() => open_(n)} className={clsx('block w-full px-5 py-4 text-left transition hover:bg-navy-50 dark:hover:bg-navy-800', !n.is_read && 'bg-brand-50/60 dark:bg-brand-500/5')}>
                <div className="flex items-start gap-3">{!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}<div><p className="text-sm font-semibold">{n.title}</p>{n.body && <p className="mt-0.5 line-clamp-2 text-xs text-navy-400">{n.body}</p>}<p className="mt-1 text-[11px] text-navy-300">{timeAgo(n.created_at)}</p></div></div>
              </button></li>))}</ul>}
        <div className="sticky bottom-0 flex gap-3 border-t border-navy-100 bg-white p-4 dark:border-navy-800 dark:bg-navy-900">
          <button className="btn btn-outline btn-sm flex-1" onClick={async () => { await bookingApi.markAllRead(); load() }}>Mark all read</button>
          <Link to={`${base}/notifications`} onClick={() => setOpen(false)} className="btn btn-navy btn-sm flex-1">View all</Link>
        </div>
      </Drawer>
    </>
  )
}

export default function DashboardLayout({ items, roleLabel }) {
  const { user, logout } = useAuth()
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => setMobile(false), [loc.pathname])
  const signOut = async () => { await logout(); nav('/login', { replace: true }) }

  const aside = (c, onNavigate) => (
    <div className="flex h-full flex-col">
      <div className={clsx('mb-6 flex items-center', c ? 'justify-center' : 'justify-between')}>{c ? <LogoMark /> : <Logo light />}</div>
      <div className="-mr-2 flex-1 overflow-y-auto pr-2"><Sidebar items={items} collapsed={c} onNavigate={onNavigate} /></div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className={clsx('flex items-center gap-3 rounded-xl bg-white/5 p-3', c && 'justify-center p-2')}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">{initials(user.full_name)}</span>
          {!c && <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{user.full_name}</p><p className="truncate text-[11px] text-white/50">{roleLabel}</p></div>}
          {!c && <button onClick={signOut} aria-label="Log out" className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper dark:bg-navy-950">
      <a href="#dash-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <aside className={clsx('noise fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy-900 p-4 transition-[width] duration-300 lg:flex', collapsed ? 'w-[76px]' : 'w-64')}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-brand-500/20 blur-[80px]" /></div>
        <div className="relative h-full">{aside(collapsed, undefined)}</div>
        <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="absolute -right-3 top-8 grid h-6 w-6 place-items-center rounded-full border border-navy-200 bg-white text-navy-600 shadow-soft transition hover:scale-110 dark:border-navy-700 dark:bg-navy-800 dark:text-white"><ChevronsLeft className={clsx('h-3.5 w-3.5 transition-transform', collapsed && 'rotate-180')} /></button>
      </aside>

      <Drawer open={mobile} onClose={() => setMobile(false)} title="Menu" side="left">
        <div className="min-h-full bg-navy-900 p-4">{aside(false, () => setMobile(false))}</div>
      </Drawer>

      <div className={clsx('transition-[padding] duration-300', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
        <header className="glass-light sticky top-0 z-20 flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-navy-100/70 dark:hover:bg-navy-800 lg:hidden" aria-label="Open menu" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
            <span className="hidden rounded-full bg-brand-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-600 sm:inline">{roleLabel}</span>
          </div>
          <div className="flex items-center gap-1"><Link to="/" className="btn btn-ghost btn-sm hidden sm:inline-flex">Public site</Link><ThemeToggle /><Bell_ /><button onClick={signOut} className="btn btn-ghost btn-sm lg:hidden" aria-label="Log out"><LogOut className="h-4 w-4" /></button></div>
        </header>
        <main id="dash-main" className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait"><PageTransition key={loc.pathname}><Outlet /></PageTransition></AnimatePresence>
        </main>
      </div>
    </div>
  )
}
