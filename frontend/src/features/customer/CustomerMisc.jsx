import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, CreditCard, Download, Headphones, MapPin, Plus, Receipt, Trash2, UserCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/common/Button'
import { Field, Input, PasswordInput, Textarea, Checkbox } from '../../components/common/Field'
import { Modal, ConfirmDialog } from '../../components/common/Modal'
import { Badge, EmptyState, ErrorState, SkeletonList } from '../../components/common/Feedback'
import { PageHeader, Section, Tabs } from '../../components/common/Layout'
import PasswordMeter from '../auth/PasswordMeter'
import { phoneRule, passwordRule } from '../auth/schemas'
import { bookingApi } from '../../api/bookingApi'
import { paymentApi } from '../../api/paymentApi'
import { authApi } from '../../api/authApi'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../auth/AuthContext'
import { PaymentList } from '../../components/booking/BookingBits'
import { applyFieldErrors, date, dateTime, errorMessage, money } from '../../utils/format'

export function PaymentsPage() {
  const pays = useApi(() => paymentApi.list({ page_size: 50 }))
  const invs = useApi(bookingApi.invoices)
  return (
    <div>
      <PageHeader title="Payments & invoices" subtitle="Everything you've paid and every invoice issued." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Payments">{pays.error ? <ErrorState error={pays.error} onRetry={pays.reload} /> : pays.loading ? <SkeletonList rows={3} /> : !pays.data.results.length ? <EmptyState icon={CreditCard} title="No payments yet" text="Payments appear here after you accept a quotation and pay." /> : (
          <ul className="divide-y divide-navy-100 dark:divide-navy-800">{pays.data.results.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><Link to={`/app/bookings/${p.booking}`} className="font-bold hover:text-brand-600">{p.booking_reference}</Link><p className="text-xs text-navy-400">{p.kind.toLowerCase()} · {dateTime(p.created_at)}</p></div><div className="text-right"><p className="font-bold tabular-nums">{money(p.amount)}</p><Badge tone={{ SUCCESS: 'green', FAILED: 'red', PENDING: 'amber' }[p.status] || 'slate'}>{p.status.replace('_', ' ').toLowerCase()}</Badge></div></li>)}</ul>)}</Section>
        <Section title="Invoices">{invs.error ? <ErrorState error={invs.error} onRetry={invs.reload} /> : invs.loading ? <SkeletonList rows={3} /> : !invs.data.results.length ? <EmptyState icon={Receipt} title="No invoices yet" text="An invoice is issued when you accept a quotation." /> : (
          <ul className="divide-y divide-navy-100 dark:divide-navy-800">{invs.data.results.map((i) => <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-bold">{i.number}</p><p className="text-xs text-navy-400">{i.booking_reference} · {date(i.created_at)} · {money(i.total)}</p></div><div className="flex items-center gap-2"><Badge tone={i.status === 'PAID' ? 'green' : i.status === 'PART_PAID' ? 'amber' : 'slate'}>{i.status.replace('_', ' ').toLowerCase()}</Badge><Button size="sm" variant="outline" icon={Download} aria-label={`Download invoice ${i.number}`} onClick={() => bookingApi.downloadInvoice(i.id).catch((e) => toast.error(errorMessage(e)))} /></div></li>)}</ul>)}</Section>
      </div>
    </div>
  )
}

const ticketSchema = z.object({ subject: z.string().trim().min(3, 'Add a short subject'), message: z.string().trim().min(10, 'Please describe the issue (10+ characters)') })
export function SupportPage() {
  const [tab, setTab] = useState('tickets')
  const [open, setOpen] = useState(false)
  const tickets = useApi(() => bookingApi.tickets({ page_size: 50 }))
  const damage = useApi(bookingApi.damageReports)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(ticketSchema) })
  const submit = async (v) => { try { await bookingApi.createTicket(v); toast.success('Support request sent.'); reset(); setOpen(false); tickets.reload(true) } catch (e) { if (!applyFieldErrors(e, setError)) toast.error(errorMessage(e)) } }
  const tone = { OPEN: 'blue', IN_PROGRESS: 'amber', RESOLVED: 'green', CLOSED: 'slate', INVESTIGATING: 'amber', REJECTED: 'red' }
  return (
    <div>
      <PageHeader title="Support" subtitle="Ask a question or follow up on a damage report." actions={<Button icon={Plus} onClick={() => setOpen(true)}>New request</Button>} />
      <Tabs tabs={[{ value: 'tickets', label: 'Requests' }, { value: 'damage', label: 'Damage & missing items' }]} value={tab} onChange={setTab} className="mb-5 w-fit" />
      {tab === 'tickets' ? (tickets.error ? <ErrorState error={tickets.error} onRetry={tickets.reload} /> : tickets.loading ? <SkeletonList /> : !tickets.data.results.length ? <EmptyState icon={Headphones} title="No support requests" text="Need help? Open a request and our team will reply." action={<Button onClick={() => setOpen(true)}>Open a request</Button>} /> : (
        <ul className="space-y-3">{tickets.data.results.map((t) => <li key={t.id} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">#{t.id} · {t.subject}</p><p className="text-xs text-navy-400">{dateTime(t.created_at)}{t.booking_reference ? ` · ${t.booking_reference}` : ''}</p></div><Badge tone={tone[t.status]}>{t.status.replace('_', ' ').toLowerCase()}</Badge></div><p className="mt-3 text-sm text-navy-500">{t.message}</p>{t.resolution && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"><b>Reply:</b> {t.resolution}</p>}</li>)}</ul>))
        : (damage.error ? <ErrorState error={damage.error} onRetry={damage.reload} /> : damage.loading ? <SkeletonList /> : !damage.data.results.length ? <EmptyState icon={AlertTriangle} title="No reports" text="You can report a damaged or missing item from a completed booking." /> : (
          <ul className="space-y-3">{damage.data.results.map((d) => <li key={d.id} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{d.kind === 'DAMAGE' ? 'Damaged' : 'Missing'}: {d.item_name}</p><p className="text-xs text-navy-400">{d.booking_reference} · {dateTime(d.created_at)}</p></div><Badge tone={tone[d.status]}>{d.status.toLowerCase()}</Badge></div><p className="mt-3 text-sm text-navy-500">{d.description}</p>{d.resolution && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"><b>Resolution:</b> {d.resolution}</p>}</li>)}</ul>))}
      <Modal open={open} onClose={() => setOpen(false)} title="New support request" size="sm" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="tk" loading={isSubmitting}>Send</Button></>}>
        <form id="tk" onSubmit={handleSubmit(submit)} noValidate className="space-y-4"><Field label="Subject" error={errors.subject?.message}>{(a) => <Input {...a} data-autofocus error={errors.subject} {...register('subject')} />}</Field><Field label="Message" error={errors.message?.message}>{(a) => <Textarea {...a} rows={5} error={errors.message} {...register('message')} />}</Field></form>
      </Modal>
    </div>
  )
}

const profileSchema = z.object({ full_name: z.string().trim().min(2, 'Enter your name'), phone: phoneRule })
const pwSchema = z.object({ current_password: z.string().min(1, 'Enter your current password'), new_password: passwordRule, confirm: z.string() }).refine((d) => d.new_password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })
const addrSchema = z.object({ label: z.string().trim().min(1, 'Add a label'), line1: z.string().trim().min(3, 'Enter the address'), city: z.string().trim().min(2, 'Enter the city'), pincode: z.string().optional(), is_default: z.boolean().optional() })

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const addrs = useApi(() => authApi.addresses.list())
  const [addrOpen, setAddrOpen] = useState(false)
  const [del, setDel] = useState(null)
  const pf = useForm({ resolver: zodResolver(profileSchema), defaultValues: { full_name: user.full_name, phone: user.phone || '' } })
  const pw = useForm({ resolver: zodResolver(pwSchema) })
  const ad = useForm({ resolver: zodResolver(addrSchema), defaultValues: { label: 'Home', is_default: false } })

  const saveProfile = async (v) => { try { await authApi.updateMe(v); await refreshUser(); toast.success('Profile updated.'); pf.reset(v) } catch (e) { if (!applyFieldErrors(e, pf.setError)) toast.error(errorMessage(e)) } }
  const savePw = async (v) => { try { await authApi.changePassword({ current_password: v.current_password, new_password: v.new_password }); toast.success('Password changed.'); pw.reset() } catch (e) { if (!applyFieldErrors(e, pw.setError)) toast.error(errorMessage(e)) } }
  const saveAddr = async (v) => { try { await authApi.addresses.create(v); toast.success('Address saved.'); ad.reset({ label: 'Home', is_default: false }); setAddrOpen(false); addrs.reload(true) } catch (e) { if (!applyFieldErrors(e, ad.setError)) toast.error(errorMessage(e)) } }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your details, saved addresses and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Personal details"><form onSubmit={pf.handleSubmit(saveProfile)} noValidate className="space-y-4">
          <Field label="Email" hint="Contact support to change your email."><Input value={user.email} disabled readOnly /></Field>
          <Field label="Full name" error={pf.formState.errors.full_name?.message}>{(a) => <Input {...a} error={pf.formState.errors.full_name} {...pf.register('full_name')} />}</Field>
          <Field label="Phone" error={pf.formState.errors.phone?.message}>{(a) => <Input {...a} type="tel" error={pf.formState.errors.phone} {...pf.register('phone')} />}</Field>
          <Button type="submit" loading={pf.formState.isSubmitting} disabled={!pf.formState.isDirty}>Save changes</Button></form></Section>
        <Section title="Change password"><form onSubmit={pw.handleSubmit(savePw)} noValidate className="space-y-4">
          <Field label="Current password" error={pw.formState.errors.current_password?.message}>{(a) => <PasswordInput {...a} autoComplete="current-password" error={pw.formState.errors.current_password} {...pw.register('current_password')} />}</Field>
          <Field label="New password" error={pw.formState.errors.new_password?.message}>{(a) => <><PasswordInput {...a} autoComplete="new-password" error={pw.formState.errors.new_password} {...pw.register('new_password')} /><PasswordMeter value={pw.watch('new_password')} /></>}</Field>
          <Field label="Confirm new password" error={pw.formState.errors.confirm?.message}>{(a) => <PasswordInput {...a} autoComplete="new-password" error={pw.formState.errors.confirm} {...pw.register('confirm')} />}</Field>
          <Button type="submit" variant="navy" loading={pw.formState.isSubmitting}>Update password</Button></form></Section>
        <Section className="lg:col-span-2" title="Saved addresses" action={<Button size="sm" icon={Plus} onClick={() => setAddrOpen(true)}>Add address</Button>}>
          {addrs.error ? <ErrorState error={addrs.error} onRetry={addrs.reload} /> : addrs.loading ? <SkeletonList rows={2} /> : !addrs.data.length ? <EmptyState icon={MapPin} title="No saved addresses" text="Save addresses to fill booking forms faster." /> : (
            <ul className="grid gap-3 sm:grid-cols-2">{addrs.data.map((a) => <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-navy-100 p-4 dark:border-navy-800"><div><p className="font-bold">{a.label}{a.is_default && <Badge tone="orange" className="ml-2">Default</Badge>}</p><p className="text-sm text-navy-400">{a.line1}, {a.city}{a.pincode ? ` - ${a.pincode}` : ''}</p></div><button aria-label={`Delete ${a.label} address`} onClick={() => setDel(a)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></li>)}</ul>)}
        </Section>
      </div>
      <Modal open={addrOpen} onClose={() => setAddrOpen(false)} title="Add address" size="sm" footer={<><Button variant="ghost" onClick={() => setAddrOpen(false)}>Cancel</Button><Button type="submit" form="ad" loading={ad.formState.isSubmitting}>Save</Button></>}>
        <form id="ad" onSubmit={ad.handleSubmit(saveAddr)} noValidate className="space-y-4">
          <Field label="Label" error={ad.formState.errors.label?.message}>{(a) => <Input {...a} data-autofocus {...ad.register('label')} />}</Field>
          <Field label="Address" error={ad.formState.errors.line1?.message}>{(a) => <Input {...a} {...ad.register('line1')} />}</Field>
          <div className="grid grid-cols-2 gap-3"><Field label="City" error={ad.formState.errors.city?.message}>{(a) => <Input {...a} {...ad.register('city')} />}</Field><Field label="Pincode">{(a) => <Input {...a} {...ad.register('pincode')} />}</Field></div>
          <Checkbox label="Make this my default address" {...ad.register('is_default')} /></form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="Delete this address?" message={del && `${del.label}: ${del.line1}`} confirmLabel="Delete" onConfirm={async () => { try { await authApi.addresses.remove(del.id); toast.success('Address deleted.'); setDel(null); addrs.reload(true) } catch (e) { toast.error(errorMessage(e)) } }} />
    </div>
  )
}
