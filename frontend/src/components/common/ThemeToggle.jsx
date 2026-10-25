import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

export default function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme()
  return (
    <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark}
      className={`relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl text-navy-600 transition hover:bg-navy-100/70 dark:text-navy-100 dark:hover:bg-navy-800 ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? 'd' : 'l'} initial={{ y: 16, opacity: 0, rotate: -40 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -16, opacity: 0, rotate: 40 }} transition={{ duration: 0.18 }}>
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
