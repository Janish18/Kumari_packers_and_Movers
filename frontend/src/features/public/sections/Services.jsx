import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, Car, Forklift, Package, Route, ShieldCheck, Truck, Warehouse, Wrench } from 'lucide-react'
import { publicApi } from '../../../api/publicApi'
import { useApi } from '../../../hooks/useApi'
import { CursorGlow, Reveal, Stagger, StaggerItem, TiltCard } from '../../../components/animations/Motion'
import { EmptyState, ErrorState, Skeleton } from '../../../components/common/Feedback'

const ICONS = { truck: Truck, route: Route, building: Building2, package: Package, forklift: Forklift, wrench: Wrench, shield: ShieldCheck, car: Car, warehouse: Warehouse }

export function ServiceGrid({ limit }) {
  const { data, loading, error, reload } = useApi(publicApi.services)
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
  const list = limit ? data.slice(0, limit) : data
  if (!list.length) return <EmptyState icon={Truck} title="Services coming soon" text="Our service list is being set up. Please check back shortly." />
  return (
    <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" gap={0.07}>
      {list.map((s) => {
        const Icon = ICONS[s.icon] || Truck
        return (
          <StaggerItem key={s.id}>
            <TiltCard className="h-full" max={5}>
              <CursorGlow className="card card-hover group h-full overflow-hidden p-6">
                <div aria-hidden className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-500/10 transition-all duration-500 group-hover:scale-[2.2] group-hover:bg-brand-500/15" />
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-navy-900 text-white shadow-glow-navy transition-all duration-300 group-hover:rotate-6 group-hover:bg-brand-500 group-hover:shadow-glow dark:bg-navy-700"><Icon className="h-7 w-7" /></span>
                <h3 className="relative mt-5 text-lg font-bold">{s.name}</h3>
                <p className="relative mt-2 text-sm font-medium text-navy-500 dark:text-navy-200">{s.summary}</p>
                <p className="relative mt-2 text-sm leading-relaxed text-navy-400">{s.description}</p>
                <Link to={`/quote?service=${s.slug}`} className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 after:absolute after:inset-0 after:content-['']">Get a quote <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
              </CursorGlow>
            </TiltCard>
          </StaggerItem>
        )
      })}
    </Stagger>
  )
}

export default function ServicesSection() {
  return (
    <section id="services" className="section">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">What we do</span>
          <h2 className="h-section mt-4">Every kind of move, <span className="text-gradient">handled with care</span></h2>
          <p className="mt-4 text-navy-400">From a single room to a full office, choose the service that fits and get an itemised quote.</p>
        </Reveal>
        <div className="mt-14"><ServiceGrid /></div>
      </div>
    </section>
  )
}
