import { Eye, HandHeart, Headphones, ReceiptText, ScrollText, Users } from 'lucide-react'
import { CursorGlow, Reveal, Stagger, StaggerItem } from '../../../components/animations/Motion'

const ITEMS = [
  [ReceiptText, 'Clear quotations', 'Every charge is listed line by line, and you accept the final quote explicitly.'],
  [Users, 'Dedicated moving team', 'An assigned driver and team for your job, visible on your booking once assigned.'],
  [HandHeart, 'Careful handling', 'Fragile items are flagged on the job sheet so the team handles them with extra care.'],
  [Eye, 'Booking transparency', 'Status changes are recorded by the people doing the work, not guessed.'],
  [Headphones, 'Customer support', 'Raise a support request or report damage straight from your dashboard.'],
  [ScrollText, 'Clear policies', 'Cancellation, rescheduling and refund terms are published up front.'],
]

export default function WhyUs() {
  return (
    <section className="section">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center"><span className="eyebrow">Why choose us</span><h2 className="h-section mt-4">Built on <span className="text-gradient">trust and transparency</span></h2></Reveal>
        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(([Icon, t, d]) => (
            <StaggerItem key={t}><CursorGlow className="card card-hover h-full overflow-hidden p-6"><span className="relative grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10"><Icon className="h-6 w-6" /></span><h3 className="relative mt-4 text-lg font-bold">{t}</h3><p className="relative mt-1.5 text-sm text-navy-400">{d}</p></CursorGlow></StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
