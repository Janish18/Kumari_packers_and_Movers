import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/common/Button'
import { Field, Input, PasswordInput } from '../../components/common/Field'
import { SuccessBurst } from '../../components/common/Feedback'
import PasswordMeter from './PasswordMeter'
import { forgotSchema, resetSchema } from './schemas'
import { authApi } from '../../api/authApi'
import { applyFieldErrors, errorMessage } from '../../utils/format'

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(forgotSchema) })
  const onSubmit = async (v) => { try { await authApi.forgotPassword(v.email); setSent(true) } catch (e) { toast.error(errorMessage(e)) } }
  if (sent) return (
    <div className="text-center"><span className="mx-auto grid h-16 w-16 animate-pop-check place-items-center rounded-full bg-brand-50 text-brand-500"><MailCheck className="h-8 w-8" /></span>
      <h1 className="mt-5 text-2xl font-extrabold">Check your inbox</h1><p className="mt-2 text-sm text-navy-400">If that email is registered, we've sent a reset link that is valid for 1 hour.</p>
      <Link to="/login" className="btn btn-outline mt-6">Back to sign in</Link></div>
  )
  return (
    <div>
      <span className="eyebrow"><KeyRound className="h-3.5 w-3.5" />Account recovery</span>
      <h1 className="mt-4 text-3xl font-extrabold">Forgot your password?</h1>
      <p className="mt-2 text-sm text-navy-400">Enter your email and we'll send you a secure link to set a new one.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-5">
        <Field label="Email" error={errors.email?.message}>{(a) => <Input {...a} type="email" autoComplete="email" error={errors.email} {...register('email')} />}</Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-brand-600 hover:underline">← Back to sign in</Link></p>
    </div>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [done, setDone] = useState(false)
  const uid = params.get('uid'), token = params.get('token')
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetSchema) })
  if (!uid || !token) return <div className="text-center"><h1 className="text-2xl font-extrabold">Invalid reset link</h1><p className="mt-2 text-sm text-navy-400">This link is missing information. Request a new one.</p><Link to="/forgot-password" className="btn btn-primary mt-6">Request new link</Link></div>
  const onSubmit = async (v) => {
    try { await authApi.resetPassword({ uid, token, new_password: v.new_password }); setDone(true); setTimeout(() => nav('/login'), 2500) } catch (e) {
      if (!applyFieldErrors(e, setError, ['new_password'])) toast.error(errorMessage(e, 'This reset link is invalid or has expired.'))
    }
  }
  if (done) return <SuccessBurst title="Password updated" text="Redirecting you to sign in…" />
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Set a new password</h1>
      <p className="mt-2 text-sm text-navy-400">Choose a strong password you don't use anywhere else.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-5">
        <Field label="New password" error={errors.new_password?.message}>{(a) => <><PasswordInput {...a} autoComplete="new-password" error={errors.new_password} {...register('new_password')} /><PasswordMeter value={watch('new_password')} /></>}</Field>
        <Field label="Confirm password" error={errors.confirm?.message}>{(a) => <PasswordInput {...a} autoComplete="new-password" error={errors.confirm} {...register('confirm')} />}</Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">Update password</Button>
      </form>
    </div>
  )
}
