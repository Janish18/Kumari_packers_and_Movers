import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, HelpCircle, MessageSquareQuote, Star } from 'lucide-react'
import clsx from 'clsx'
import { publicApi } from '../../../api/publicApi'
import { useApi } from '../../../hooks/useApi'
import { Reveal } from '../../../components/animations/Motion'
import { EmptyState, ErrorState, Skeleton } from '../../../components/common/Feedback'
import { date } from '../../../utils/format'

function Stars({ n }) { return <div className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={clsx('h-4 w-4', i <= n ? 'fill-amber-400 text-amber-400' : 'text-navy-200')} />)}</div> }

export function ReviewsSection() {
  const { data, loading, error, reload } = useApi(publicApi.reviews)
  const [i, setI] = useState(0)
  useEffect(() => { if (!data || data.length < 2) return undefined; const t = setInterval(() => setI((x) => (x + 1) % data.length), 6000); return () => clearInterval(t) }, [data])
  return (
    <section id="reviews" className="section">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center"><span className="eyebrow">Customer reviews</span><h2 className="h-section mt-4">Words from <span className="text-gradient">real customers</span></h2></Reveal>
        <div className="mx-auto mt-12 max-w-3xl">
          {error ? <ErrorState error={error} onRetry={reload} />
            : loading ? <Skeleton className="h-56 rounded-3xl" />
              : !data.length ? <EmptyState icon={MessageSquareQuote} title="No reviews yet" text="Reviews appear here after customers complete a move and share feedback. We never publish made-up testimonials." />
                : (
                  <div>
                    <div className="card relative min-h-[14rem] overflow-hidden p-8 sm:p-10">
                      <MessageSquareQuote aria-hidden className="absolute right-6 top-6 h-16 w-16 text-brand-500/10" />
                      <AnimatePresence mode="wait">
                        <motion.figure key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4 }}>
                          <Stars n={data[i].rating} />
                          <blockquote className="mt-4 text-lg font-medium leading-relaxed sm:text-xl">{data[i].comment || 'Great service.'}</blockquote>
                          <figcaption className="mt-5 text-sm"><span className="font-bold">{data[i].author}</span><span className="text-navy-400"> · {date(data[i].created_at)}</span></figcaption>
                          {data[i].admin_response && <p className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-500 dark:bg-navy-800"><b>Our reply:</b> {data[i].admin_response}</p>}
                        </motion.figure>
                      </AnimatePresence>
                    </div>
                    {data.length > 1 && <div className="mt-5 flex justify-center gap-2">{data.map((_, k) => <button key={k} aria-label={`Show review ${k + 1}`} onClick={() => setI(k)} className={clsx('h-2 rounded-full transition-all', k === i ? 'w-8 bg-brand-500' : 'w-2 bg-navy-200 hover:bg-navy-300')} />)}</div>}
                  </div>
                )}
        </div>
      </div>
    </section>
  )
}

export function FaqSection() {
  const { data, loading, error, reload } = useApi(publicApi.faqs)
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="section bg-white dark:bg-navy-900/40">
      <div className="container grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <Reveal><span className="eyebrow">FAQ</span><h2 className="h-section mt-4">Questions, <span className="text-gradient">answered</span></h2><p className="mt-4 text-navy-400">Pricing, booking, packing, cancellation and more. Can't find it? Reach out from your dashboard or our contact page.</p></Reveal>
        <div>
          {error ? <ErrorState error={error} onRetry={reload} />
            : loading ? <div className="space-y-3">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-16 rounded-2xl" />)}</div>
              : !data.length ? <EmptyState icon={HelpCircle} title="FAQs coming soon" text="Frequently asked questions will be published here." />
                : <ul className="space-y-3">{data.map((f, k) => (
                  <li key={f.id} className={clsx('card overflow-hidden transition-shadow', open === k && 'shadow-lift')}>
                    <h3><button aria-expanded={open === k} aria-controls={`faq-${f.id}`} onClick={() => setOpen(open === k ? -1 : k)} className="flex w-full items-center justify-between gap-4 p-5 text-left font-bold">
                      <span><span className="mb-0.5 block text-[11px] font-bold uppercase tracking-widest text-brand-500">{f.category}</span>{f.question}</span>
                      <ChevronDown className={clsx('h-5 w-5 shrink-0 text-brand-500 transition-transform duration-300', open === k && 'rotate-180')} /></button></h3>
                    <AnimatePresence initial={false}>{open === k && <motion.div id={`faq-${f.id}`} role="region" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden"><p className="px-5 pb-5 text-sm leading-relaxed text-navy-500 dark:text-navy-300">{f.answer}</p></motion.div>}</AnimatePresence>
                  </li>))}</ul>}
        </div>
      </div>
    </section>
  )
}
