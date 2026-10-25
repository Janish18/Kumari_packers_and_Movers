import { Link, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Route, PackageCheck } from 'lucide-react'
import Logo from '../common/Logo'
import ThemeToggle from '../common/ThemeToggle'
import TruckScene from '../animations/TruckScene'
import { Aurora } from '../animations/Motion'

const POINTS = [
  [PackageCheck, 'Itemised quotations', 'See exactly what you are paying for before you accept.'],
  [Route, 'Verified status updates', 'Every step of your move is recorded by the team handling it.'],
  [ShieldCheck, 'Private by design', 'Your bookings and addresses are visible only to you.'],
]

/** Split screen: brand storytelling on the left (hidden on small screens), form on the right. */
export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="noise relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col">
        <Aurora />
        <div aria-hidden className="absolute inset-0 bg-grid-navy [mask-image:radial-gradient(70%_60%_at_50%_40%,#000,transparent)] [background-size:44px_44px]" />
        <div className="relative"><Logo light /></div>
        <div className="relative my-auto">
          <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-4xl font-extrabold leading-tight xl:text-5xl">Moving homes.<br /><span className="text-gradient-animated">Moving with care.</span></motion.h2>
          <TruckScene className="mx-auto mt-6 max-w-lg" />
          <ul className="mt-6 space-y-4">
            {POINTS.map(([Icon, t, d], i) => (
              <motion.li key={t} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.12 }} className="glass flex gap-4 rounded-2xl p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/90"><Icon className="h-5 w-5" /></span>
                <div><p className="font-bold">{t}</p><p className="text-sm text-white/65">{d}</p></div>
              </motion.li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="relative flex flex-col bg-paper dark:bg-navy-950">
        <div className="flex items-center justify-between p-5 lg:justify-end"><div className="lg:hidden"><Logo /></div><div className="flex items-center gap-2"><Link to="/" className="btn btn-ghost btn-sm">← Back to site</Link><ThemeToggle /></div></div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12"><div className="w-full max-w-md"><Outlet /></div></div>
      </main>
    </div>
  )
}
