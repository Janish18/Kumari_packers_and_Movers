import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Aurora, Magnetic, Reveal } from '../../../components/animations/Motion'
import { useSiteConfig } from '../../../hooks/useSiteConfig'

export function AboutSection() {
  const { content } = useSiteConfig()
  const about = content?.about
  return (
    <section id="about" className="section">
      <div className="container grid items-center gap-12 lg:grid-cols-2">
        <Reveal direction="right">
          <span className="eyebrow">About us</span>
          <h2 className="h-section mt-4">{about?.title || 'A moving company that treats your home like its own'}</h2>
          <div className="mt-5 space-y-4 leading-relaxed text-navy-500 dark:text-navy-300">
            {about?.body ? about.body.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>) : (
              <><p>Kumari Packers and Movers helps families and businesses relocate with less stress. You describe your move, we send an itemised quotation, and once you accept it your booking is tracked from confirmation to delivery.</p>
                <p>Our approach is simple: clear prices, careful handling and honest status updates, recorded by the team doing the work.</p></>
            )}
          </div>
        </Reveal>
        <Reveal direction="left">
          <div className="card noise relative overflow-hidden bg-navy-900 p-8 text-white dark:bg-navy-800">
            <Aurora />
            <ul className="relative space-y-5">
              {[['Describe', 'Share rooms, floors and special items.'], ['Review', 'Get an itemised quotation and accept it online.'], ['Relax', 'Follow verified updates while the team moves you.']].map(([t, d], i) => (
                <li key={t} className="flex gap-4"><span className="font-display text-4xl font-extrabold text-brand-400/80">0{i + 1}</span><div><p className="text-lg font-bold">{t}</p><p className="text-sm text-white/65">{d}</p></div></li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="section pt-0">
      <div className="container">
        <Reveal direction="scale">
          <div className="noise relative overflow-hidden rounded-4xl bg-navy-900 px-6 py-16 text-center text-white sm:px-12 sm:py-20">
            <Aurora />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-display text-3xl font-extrabold sm:text-5xl">Ready for a <span className="text-gradient-animated">stress-free move?</span></h2>
              <p className="mt-4 text-white/70">Tell us about your move and get an itemised estimate in minutes.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Magnetic><Link to="/quote" className="btn btn-primary btn-lg btn-shine group">Get a Free Moving Quote <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></Link></Magnetic>
                <Magnetic><Link to="/contact" className="btn btn-lg border border-white/25 bg-white/5 text-white hover:bg-white/15"><MessageCircle className="h-5 w-5" />Talk to us</Link></Magnetic>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
