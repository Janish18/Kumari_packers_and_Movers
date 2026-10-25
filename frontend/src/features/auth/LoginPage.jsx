import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/common/Button'
import { Checkbox, Field, Input, PasswordInput } from '../../components/common/Field'
import { useAuth } from './AuthContext'
import { loginSchema } from './schemas'
import { errorMessage, roleHome } from '../../utils/format'

const AREA = { CUSTOMER: '/app', ADMIN: '/admin', DRIVER: '/driver' }

/** Only follow `next` if it is a same-site path that belongs to the user's own area. */
export function safeNext(next, role) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return roleHome(role)
  return next.startsWith(AREA[role]) ? next : roleHome(role)
}

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [formError, setFormError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { identifier: '', password: '', remember_me: false } })

  const onSubmit = async (v) => {
    setFormError('')
    try {
      const me = await login(v)
      toast.success(`Welcome back, ${me.full_name.split(' ')[0]}!`)
      nav(safeNext(params.get('next'), me.role), { replace: true })
    } catch (e) {
      setFormError(errorMessage(e, 'Could not sign you in. Please try again.'))
      setShakeKey((k) => k + 1)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      <span className="eyebrow"><LogIn className="h-3.5 w-3.5" />Secure sign in</span>
      <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Welcome back</h1>
      <p className="mt-2 text-sm text-navy-400">One login for customers, drivers and administrators. We detect your role automatically.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        {formError && <div key={shakeKey} role="alert" className="flex animate-shake items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{formError}</div>}
        <Field label="Email or phone" error={errors.identifier?.message}>{(a) => <Input {...a} autoComplete="username" placeholder="you@example.com or 98XXXXXXXX" error={errors.identifier} {...register('identifier')} />}</Field>
        <Field label="Password" error={errors.password?.message}>{(a) => <PasswordInput {...a} autoComplete="current-password" placeholder="Your password" error={errors.password} {...register('password')} />}</Field>
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Remember me" {...register('remember_me')} />
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" shine loading={isSubmitting} className="group w-full" iconRight={ArrowRight}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="mt-8 text-center text-sm text-navy-400">New to Kumari Packers and Movers? <Link to="/register" className="font-bold text-brand-600 hover:underline">Create an account</Link></p>
    </motion.div>
  )
}
