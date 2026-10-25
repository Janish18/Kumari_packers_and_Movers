import { forwardRef } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

const VARIANTS = { primary: 'btn-primary', navy: 'btn-navy', outline: 'btn-outline', ghost: 'btn-ghost', danger: 'btn-danger' }
const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' }

const Button = forwardRef(function Button({ variant = 'primary', size = 'md', full = false, loading = false, shine = false, icon: Icon, iconRight: IconRight, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={clsx('btn', VARIANTS[variant], SIZES[size], shine && 'btn-shine', full && 'w-full', className)} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon && <Icon className="h-4 w-4" aria-hidden />}
      {children}
      {!loading && IconRight && <IconRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />}
    </button>
  )
})
export default Button
