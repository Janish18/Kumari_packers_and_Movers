import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { ArrowRight, Headphones, LogIn, Mail, MapPin, Menu, Phone, X } from 'lucide-react'
import Logo from '../common/Logo'
import ThemeToggle from '../common/ThemeToggle'
import { ScrollProgress } from '../animations/Motion'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { useAuth } from '../../features/auth/AuthContext'
import { roleHome } from '../../utils/format'

const NAV = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/#services' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Locations', to: '/#locations' },
  { label: 'About Us', to: '/#about' },
  { label: 'Reviews', to: '/#reviews' },
  { label: 'Contact', to: '/contact' },
]

const Facebook = (p) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z" /></svg>
const Instagram = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r=".9" fill="currentColor" /></svg>

function ScrollToHash() {
  const { hash, pathname } = useLocation()
  useEffect(() => {
    if (hash) { const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); return () => clearTimeout(t) }
    window.scrollTo({ top: 0 })
    return undefined
  }, [hash, pathname])
  return null
}

function AnnouncementBar({ contact, message }) {
  const phone = contact?.phone
  return (
    <div className="relative z-50 bg-navy-950 text-xs text-white/90">
      <div className="container flex min-h-9 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5">
        <p className="flex items-center gap-2 font-medium"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>{message || 'Request a free, itemised moving quotation online.'}</p>
        <div className="flex items-center gap-5">
          {phone && <a href={`tel:${phone}`} className="flex items-center gap-1.5 transition hover:text-brand-300"><Phone className="h-3.5 w-3.5" />{phone}</a>}
          <Link to="/contact" className="flex items-center gap-1.5 transition hover:text-brand-300"><Headphones className="h-3.5 w-3.5" />Customer support</Link>
        </div>
      </div>
    </div>
  )
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const loc = useLocation()
  useEffect(() => { const on = () => setScrolled(window.scrollY > 24); on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on) }, [])
  useEffect(() => setOpen(false), [loc.pathname, loc.hash])
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])

  return (
    <header className={clsx('sticky top-0 z-40 transition-all duration-300', scrolled ? 'glass-light py-2 shadow-soft' : 'bg-transparent py-4')}>
      <div className="container flex items-center justify-between gap-4">
        <Logo light={!scrolled} />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.label} to={n.to} end={n.to === '/'} className={({ isActive }) => clsx('group relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors', isActive && !n.to.includes('#') ? 'text-brand-500' : scrolled ? 'text-navy-600 hover:text-brand-600 dark:text-navy-100' : 'text-white/85 hover:text-brand-300')}>
              {n.label}<span className="absolute inset-x-3 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded bg-brand-500 transition-transform duration-300 group-hover:scale-x-100" />
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className={clsx('hidden sm:grid', !scrolled && '!text-white hover:!bg-white/10')} />
          {user ? (
            <Link to={roleHome(user.role)} className={clsx('btn btn-sm hidden sm:inline-flex', scrolled ? 'btn-navy' : 'btn-outline !border-white/30 !bg-white/10 !text-white')}>My dashboard</Link>
          ) : (
            <>
              <Link to="/login" className={clsx('btn btn-ghost btn-sm hidden sm:inline-flex', !scrolled && '!text-white hover:!bg-white/10')}><LogIn className="h-4 w-4" />Login</Link>
              <Link to="/register" className={clsx('btn btn-outline btn-sm hidden md:inline-flex', !scrolled && '!border-white/30 !bg-white/10 !text-white hover:!bg-white/20')}>Register</Link>
            </>
          )}
          <Link to="/quote" className="btn btn-primary btn-sm btn-shine hidden sm:inline-flex">Get a Quote</Link>
          <button className={clsx('grid h-10 w-10 place-items-center rounded-xl lg:hidden', scrolled ? 'text-navy-700 hover:bg-navy-100/70 dark:text-white dark:hover:bg-navy-800' : 'text-white hover:bg-white/10')} aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label="Menu" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 flex h-full w-[min(88vw,22rem)] flex-col bg-navy-900 p-6 text-white">
              <div className="mb-8 flex items-center justify-between"><Logo light /><button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/10"><X className="h-6 w-6" /></button></div>
              <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }} className="space-y-1">
                {NAV.map((n) => (
                  <motion.li key={n.label} variants={{ hidden: { opacity: 0, x: 24 }, show: { opacity: 1, x: 0 } }}>
                    <Link to={n.to} className="flex items-center justify-between rounded-xl px-4 py-3.5 text-lg font-semibold transition hover:bg-white/10">{n.label}<ArrowRight className="h-4 w-4 text-brand-400" /></Link>
                  </motion.li>
                ))}
              </motion.ul>
              <div className="mt-auto space-y-3 pt-6">
                <Link to="/quote" className="btn btn-primary btn-lg w-full">Get a Free Quote</Link>
                {user ? <Link to={roleHome(user.role)} className="btn btn-outline w-full !bg-white/5 !text-white">My dashboard</Link> : (
                  <div className="grid grid-cols-2 gap-3"><Link to="/login" className="btn btn-outline !bg-white/5 !text-white">Login</Link><Link to="/register" className="btn btn-outline !bg-white/5 !text-white">Register</Link></div>
                )}
                <div className="flex justify-center pt-2"><ThemeToggle className="!text-white" /></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function Footer({ contact, config }) {
  const social = config?.social || {}
  const col = 'space-y-2.5 text-sm text-white/65'
  const link = 'transition hover:text-brand-300'
  return (
    <footer className="noise relative overflow-hidden bg-navy-950 text-white">
      <div aria-hidden className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-brand-500/15 blur-[120px]" />
      <div className="container relative grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/65">Careful house shifting and relocation with itemised quotations, verified booking updates and a team that treats your belongings like its own.</p>
          <Link to="/quote" className="btn btn-primary btn-shine mt-6">Get a Free Moving Quote <ArrowRight className="h-4 w-4" /></Link>
          {(social.facebook || social.instagram) && (
            <div className="mt-6 flex gap-3">
              {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer noopener" aria-label="Facebook" className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 transition hover:-translate-y-1 hover:bg-brand-500"><Facebook className="h-4 w-4" /></a>}
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer noopener" aria-label="Instagram" className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 transition hover:-translate-y-1 hover:bg-brand-500"><Instagram className="h-4 w-4" /></a>}
            </div>
          )}
        </div>
        <div><h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-brand-300">Services</h3>
          <ul className={col}>{['Local shifting', 'Intercity relocation', 'Office relocation', 'Packing & unpacking', 'Storage'].map((s) => <li key={s}><Link className={link} to="/services">{s}</Link></li>)}</ul></div>
        <div><h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-brand-300">Company</h3>
          <ul className={col}><li><Link className={link} to="/#about">About us</Link></li><li><Link className={link} to="/#how-it-works">How it works</Link></li><li><Link className={link} to="/track">Track booking</Link></li><li><Link className={link} to="/contact">Contact</Link></li><li><Link className={link} to="/login">Login</Link></li></ul></div>
        <div><h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-brand-300">Contact</h3>
          <ul className={col}>
            {contact?.phone ? <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /><a className={link} href={`tel:${contact.phone}`}>{contact.phone}</a></li> : null}
            {contact?.email ? <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /><a className={link} href={`mailto:${contact.email}`}>{contact.email}</a></li> : null}
            {contact?.address ? <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />{contact.address}</li> : null}
            {!contact?.phone && !contact?.email && !contact?.address && <li>Contact details will appear here once added by the business.</li>}
          </ul></div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Kumari Packers and Movers. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link className={link} to="/privacy">Privacy policy</Link><Link className={link} to="/terms">Terms</Link><Link className={link} to="/refund-policy">Refund policy</Link><Link className={link} to="/cancellation-policy">Cancellation policy</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default function PublicLayout() {
  const { contact, config } = useSiteConfig()
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <ScrollProgress />
      <ScrollToHash />
      <AnnouncementBar contact={contact} message={config?.announcement} />
      <Navbar />
      <main id="main"><Outlet /></main>
      <Footer contact={contact} config={config} />
    </div>
  )
}
