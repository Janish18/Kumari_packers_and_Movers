import { motion } from 'framer-motion'
import { CheckCircle2, ClipboardList, FileCheck2, Package, ReceiptText, Star, Truck } from 'lucide-react'
import { Reveal } from '../../../components/animations/Motion'

const STEPS = [
  [ClipboardList, 'Enter your requirements', 'Tell us where, when and what you are moving.'],
  [ReceiptText, 'Receive a transparent quotation', 'An itemised quote with no hidden lines.'],
  [FileCheck2, 'Confirm the booking', 'Accept the quote and we lock in your date.'],
  [Package, 'Prepare and pack', 'Pack yourself or let our team do it.'],
  [Truck, 'Track the moving team', 'Follow verified status updates during the move.'],
  [CheckCircle2, 'Complete delivery', 'Confirm everything arrived as expected.'],
  [Star, 'Share your feedback', 'Rate the service to help others decide.'],
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section overflow-hidden bg-white dark:bg-navy-900/40">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center"><span className="eyebrow">How it works</span><h2 className="h-section mt-4">Seven simple steps from <span className="text-gradient">quote to “we’re home”</span></h2></Reveal>
        <div className="relative mx-auto mt-16 max-w-4xl">
          <div aria-hidden className="absolute bottom-6 left-6 top-6 w-0.5 -translate-x-1/2 md:left-1/2"><motion.div className="h-full w-full origin-top bg-gradient-to-b from-brand-500 via-brand-300 to-transparent" initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: 'easeOut' }} /></div>
          <ol className="space-y-10">
            {STEPS.map(([Icon, t, d], i) => (
              <li key={t} className="relative md:grid md:grid-cols-2 md:gap-16">
                <Reveal direction={i % 2 ? 'left' : 'right'} className={i % 2 ? 'md:col-start-2' : 'md:text-right'}>
                  <div className="card card-hover ml-16 p-5 md:ml-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-500">Step {i + 1}</p>
                    <h3 className="mt-1 text-lg font-bold">{t}</h3><p className="mt-1 text-sm text-navy-400">{d}</p>
                  </div>
                </Reveal>
                <span className="absolute left-0 top-3 md:left-1/2 md:-translate-x-1/2"><motion.span initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: 'spring', delay: 0.15 }} className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-white shadow-glow"><Icon className="h-6 w-6" /></motion.span></span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
