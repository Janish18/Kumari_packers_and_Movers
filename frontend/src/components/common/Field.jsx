import { forwardRef, useId, useState } from 'react'
import clsx from 'clsx'
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react'

/** Label + control + error wrapper. Clones `id` and aria props onto its child control. */
export function Field({ label, error, hint, required, children, className }) {
  const id = useId()
  const errId = `${id}-err`
  const control = typeof children === 'function' ? children({ id, 'aria-invalid': !!error || undefined, 'aria-describedby': error ? errId : undefined }) : children
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}{required && <span className="text-brand-500"> *</span>}</label>}
      {control}
      {hint && !error && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
      {error && <p id={errId} role="alert" className="mt-1 flex animate-slide-down items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" aria-hidden />{error}</p>}
    </div>
  )
}

export const Input = forwardRef(function Input({ error, className, ...p }, ref) {
  return <input ref={ref} className={clsx('input', error && 'input-error animate-shake', className)} {...p} />
})

export const Textarea = forwardRef(function Textarea({ error, className, rows = 3, ...p }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx('input resize-y', error && 'input-error', className)} {...p} />
})

export const Select = forwardRef(function Select({ error, className, children, ...p }, ref) {
  return <select ref={ref} className={clsx('input appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10', error && 'input-error', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2393A5D4'><path d='M5.5 7.5l4.5 5 4.5-5z'/></svg>\")" }} {...p}>{children}</select>
})

export const PasswordInput = forwardRef(function PasswordInput({ error, className, ...p }, ref) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={clsx('input pr-11', error && 'input-error animate-shake', className)} {...p} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 dark:hover:bg-navy-800">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
})

export const Checkbox = forwardRef(function Checkbox({ label, error, className, ...p }, ref) {
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-navy-700 dark:text-navy-200">
        <span className="relative mt-0.5 h-5 w-5 shrink-0">
          <input ref={ref} type="checkbox" className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-md border-2 border-navy-200 bg-white transition checked:border-brand-500 checked:bg-brand-500 dark:border-navy-600 dark:bg-navy-900" {...p} />
          <Check className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 scale-0 text-white transition-transform duration-200 peer-checked:scale-100" strokeWidth={3} aria-hidden />
        </span>
        <span>{label}</span>
      </label>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
})

/** Pill toggle (e.g. "Packing needed"). */
export function Toggle({ checked, onChange, label, description }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={clsx('flex w-full items-center justify-between gap-4 rounded-xl border p-3.5 text-left transition-all', checked ? 'border-brand-400 bg-brand-50 shadow-soft dark:bg-brand-500/10' : 'border-navy-200 bg-white hover:border-navy-300 dark:border-navy-700 dark:bg-navy-900')}>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="block text-xs text-navy-400">{description}</span>}
      </span>
      <span className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-500' : 'bg-navy-200 dark:bg-navy-700')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}
