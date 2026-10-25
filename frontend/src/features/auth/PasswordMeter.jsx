import clsx from 'clsx'
import { passwordStrength } from './schemas'

const LABELS = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong']
const COLORS = ['bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500']
export default function PasswordMeter({ value }) {
  if (!value) return null
  const s = passwordStrength(value)
  return (
    <div className="mt-2 animate-fade-in" aria-live="polite">
      <div className="flex gap-1.5">{[0, 1, 2, 3].map((i) => <span key={i} className={clsx('h-1.5 flex-1 rounded-full transition-all duration-500', i < s ? COLORS[s] : 'bg-navy-100 dark:bg-navy-800')} />)}</div>
      <p className="mt-1 text-xs text-navy-400">Strength: <span className="font-semibold">{LABELS[s]}</span></p>
    </div>
  )
}
