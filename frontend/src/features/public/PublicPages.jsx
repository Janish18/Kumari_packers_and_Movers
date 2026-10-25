import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileText, Headphones, Mail, MapPin, MapPinned, Phone } from 'lucide-react'
import Estimator from '../../components/booking/Estimator'
import { ServiceGrid } from './sections/Services'
import { Aurora, Reveal } from '../../components/animations/Motion'
import { EmptyState, ErrorState, SkeletonList } from '../../components/common/Feedback'
import StatusBadge from '../../components/common/StatusBadge'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../../hooks/useApi'
import { bookingApi } from '../../api/bookingApi'
import { loadQuoteDraft } from '../../utils/draft'
import { date } from '../../utils/format'

function Banner({ eyebrow, title, text }) {
  return (
    <section className="noise relative -mt-[76px] overflow-hidden bg-navy-900 pb-16 pt-32 text-white sm:pb-20 sm:pt-36">
      <Aurora />
      <div aria-hidden className="absolute inset-0 bg-grid-navy [background-size:44px_44px] [mask-image:radial-gradient(70%_80%_at_50%_0%,#000,transparent)]" />
      <div className="container relative"><span className="eyebrow !bg-white/10 !text-brand-300">{eyebrow}</span>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold sm:text-5xl">{title}</h1>{text && <p className="mt-4 max-w-2xl text-white/70">{text}</p>}</div>
    </section>
  )
}

export function QuotePage() {
  const [params] = useSearchParams()
  const initial = useMemo(() => { const d = loadQuoteDraft() || {}; const { pickup_city, drop_city, move_date, property_type } = d; return Object.fromEntries(Object.entries({ pickup_city, drop_city, move_date, property_type }).filter(([, v]) => v)) }, [])
  return (
    <>
      <Banner eyebrow="Free estimate" title="Get your moving estimate" text={params.get('service') ? 'You picked a service. Tell us about your move and we will estimate the cost.' : 'Tell us about your move. You will see an itemised estimate, then can request a formal quotation.'} />
      <section className="section pt-12"><div className="container"><Estimator initial={initial} /></div></section>
    </>
  )
}

export function ServicesPage() {
  return (
    <>
      <Banner eyebrow="Our services" title="Everything you need to move" text="Choose a service and get a quote. Availability of some services depends on your route." />
      <section className="section pt-12"><div className="container"><ServiceGrid /></div></section>
    </>
  )
}

export function ContactPage() {
  const { contact, loaded } = useSiteConfig()
  const { user } = useAuth()
  const rows = [[Phone, 'Phone', contact.phone, contact.phone && `tel:${contact.phone}`], [Mail, 'Email', contact.email, contact.email && `mailto:${contact.email}`], [MapPin, 'Office', contact.address]]
  const any = rows.some((r) => r[2])
  return (
    <>
      <Banner eyebrow="Contact" title="We're here to help" text="Reach the team or raise a support request about an existing booking." />
      <section className="section pt-12"><div className="container grid gap-8 lg:grid-cols-2">
        <Reveal className="card p-8"><h2 className="text-xl font-bold">Contact details</h2>
          {!loaded ? null : !any ? <p className="mt-4 text-sm text-navy-400">Contact details have not been added yet. Please use the support request on the right.</p> : (
            <ul className="mt-6 space-y-5">{rows.filter((r) => r[2]).map(([Icon, l, v, href]) => <li key={l} className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10"><Icon className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-wide text-navy-400">{l}</p>{href ? <a href={href} className="font-semibold hover:text-brand-600">{v}</a> : <p className="font-semibold">{v}</p>}</div></li>)}</ul>)}
        </Reveal>
        <Reveal className="card noise relative overflow-hidden bg-navy-900 p-8 text-white dark:bg-navy-800"><Aurora /><div className="relative"><Headphones className="h-10 w-10 text-brand-400" /><h2 className="mt-4 text-xl font-bold">Support for your booking</h2><p className="mt-2 text-sm text-white/70">Customers can open a support request, report damaged or missing items and follow replies from their dashboard.</p>
          <Link to={user?.role === 'CUSTOMER' ? '/app/support' : '/login?next=%2Fapp%2Fsupport'} className="btn btn-primary btn-shine mt-6">{user?.role === 'CUSTOMER' ? 'Open support' : 'Log in to open a request'}<ArrowRight className="h-4 w-4" /></Link></div></Reveal>
      </div></section>
    </>
  )
}

const LEGAL = { privacy: 'Privacy policy', terms: 'Terms & conditions', 'refund-policy': 'Refund policy', 'cancellation-policy': 'Cancellation policy' }
/** Policy text is entered by the business (Admin > Content). Nothing legal is invented here. */
export function LegalPage({ slug }) {
  const { content, loaded } = useSiteConfig()
  const c = content?.[slug]
  return (
    <>
      <Banner eyebrow="Policies" title={c?.title || LEGAL[slug]} />
      <section className="section pt-12"><div className="container max-w-3xl">
        {!loaded ? <SkeletonList rows={3} /> : !c?.body ? <EmptyState icon={FileText} title="This policy has not been published yet" text="The business has not published this document. Please contact us for details." action={<Link to="/contact" className="btn btn-primary">Contact us</Link>} />
          : <article className="card whitespace-pre-line p-8 leading-relaxed text-navy-600 dark:text-navy-200">{c.body}</article>}
      </div></section>
    </>
  )
}

export function TrackPage() {
  const { user } = useAuth()
  const isCustomer = user?.role === 'CUSTOMER'
  const { data, loading, error, reload } = useApi(() => bookingApi.list({ page_size: 20 }), [isCustomer], { enabled: isCustomer })
  return (
    <>
      <Banner eyebrow="Track" title="Track your booking" text="For your privacy, tracking is available inside your account." />
      <section className="section pt-12"><div className="container max-w-3xl">
        {!user ? <EmptyState icon={MapPinned} title="Log in to track a booking" text="Your booking status, timeline and driver details are visible only to you." action={<Link to="/login?next=%2Fapp%2Fbookings" className="btn btn-primary btn-shine">Log in</Link>} />
          : !isCustomer ? <EmptyState icon={MapPinned} title="Tracking is for customers" text="Open your own dashboard to manage jobs." />
            : error ? <ErrorState error={error} onRetry={reload} /> : loading ? <SkeletonList /> : !data.results.length ? <EmptyState icon={MapPinned} title="No bookings yet" action={<Link to="/quote" className="btn btn-primary">Get a quote</Link>} />
              : <ul className="space-y-3">{data.results.map((b) => <li key={b.id}><Link to={`/app/bookings/${b.id}`} className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-bold">{b.reference}</p><p className="text-sm text-navy-400">{b.pickup_city} → {b.drop_city} · {date(b.move_date)}</p></div><StatusBadge status={b.status} /></Link></li>)}</ul>}
      </div></section>
    </>
  )
}

export function NotFoundPage() {
  return (
    <>
      <Banner eyebrow="Error 404" title="This page took a wrong turn" text="The page you're looking for doesn't exist or has moved." />
      <section className="section pt-12"><div className="container text-center"><Link to="/" className="btn btn-primary btn-shine">Back to home</Link></div></section>
    </>
  )
}
