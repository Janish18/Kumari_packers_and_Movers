import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { ArrowRight, UserPlus } from 'lucide-react'
import Button from '../../components/common/Button'
import { SuccessBurst } from '../../components/common/Feedback'
import { Checkbox, Field, Input, PasswordInput } from '../../components/common/Field'
import PasswordMeter from './PasswordMeter'
import { registerSchema } from './schemas'
import { authApi } from '../../api/authApi'
import { applyFieldErrors, errorMessage } from '../../utils/format'

export default function RegisterPage() {
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState('')
  const [params] = useSearchParams()
  const next = params.get('next')
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema), defaultValues: { accept_terms: false } })

  const onSubmit = async (v) => {
    setFormError('')
    try { await authApi.register(v); setDone(true) } catch (e) {
      if (!applyFieldErrors(e, setError)) setFormError(errorMessage(e))
    }
  }

  if (done) {
    return (
      <SuccessBurst title="Account created!" text="Your customer account is ready. Sign in to request quotations, track moves and manage bookings.">
        <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="btn btn-primary btn-lg btn-shine">Continue to sign in</Link>
      </SuccessBurst>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      <span className="eyebrow"><UserPlus className="h-3.5 w-3.5" />Customer registration</span>
      <h1 className="mt-4 text-3xl font-extrabold">Create your account</h1>
      <p className="mt-2 text-sm text-navy-400">Registration is for customers only. Driver and admin accounts are created by the business.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-4">
        {formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</div>}
        <Field label="Full name" required error={errors.full_name?.message}>{(a) => <Input {...a} autoComplete="name" error={errors.full_name} {...register('full_name')} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required error={errors.email?.message}>{(a) => <Input {...a} type="email" autoComplete="email" error={errors.email} {...register('email')} />}</Field>
          <Field label="Phone" required error={errors.phone?.message}>{(a) => <Input {...a} type="tel" autoComplete="tel" placeholder="98XXXXXXXX" error={errors.phone} {...register('phone')} />}</Field>
        </div>
        <Field label="Password" required error={errors.password?.message}>{(a) => <><PasswordInput {...a} autoComplete="new-password" error={errors.password} {...register('password')} /><PasswordMeter value={watch('password')} /></>}</Field>
        <Field label="Confirm password" required error={errors.confirm_password?.message}>{(a) => <PasswordInput {...a} autoComplete="new-password" error={errors.confirm_password} {...register('confirm_password')} />}</Field>
        <details className="group rounded-xl border border-navy-100 p-3 dark:border-navy-800">
          <summary className="cursor-pointer text-sm font-semibold text-navy-600 dark:text-navy-200">Add an address (optional)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Address" className="sm:col-span-2">{(a) => <Input {...a} autoComplete="street-address" {...register('address_line1')} />}</Field>
            <Field label="City">{(a) => <Input {...a} autoComplete="address-level2" {...register('city')} />}</Field>
            <Field label="Pincode">{(a) => <Input {...a} autoComplete="postal-code" {...register('pincode')} />}</Field>
          </div>
        </details>
        <Checkbox error={errors.accept_terms?.message} label={<>I agree to the <Link to="/terms" target="_blank" className="font-semibold text-brand-600 underline">Terms</Link> and <Link to="/privacy" target="_blank" className="font-semibold text-brand-600 underline">Privacy Policy</Link>.</>} {...register('accept_terms')} />
        <Button type="submit" size="lg" shine loading={isSubmitting} className="group w-full" iconRight={ArrowRight}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-navy-400">Already registered? <Link to="/login" className="font-bold text-brand-600 hover:underline">Sign in</Link></p>
    </motion.div>
  )
}
