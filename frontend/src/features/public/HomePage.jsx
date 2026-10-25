import Hero from './sections/Hero'
import ServicesSection from './sections/Services'
import HowItWorks from './sections/HowItWorks'
import WhyUs from './sections/WhyUs'
import Locations from './sections/Locations'
import { FaqSection, ReviewsSection } from './sections/ReviewsFaq'
import { AboutSection, FinalCta } from './sections/AboutCta'
import Estimator from '../../components/booking/Estimator'
import { Marquee, Reveal } from '../../components/animations/Motion'
import { publicApi } from '../../api/publicApi'
import { useApi } from '../../hooks/useApi'

function ServiceTicker() {
  const { data } = useApi(publicApi.services)
  if (!data?.length) return null
  return <div className="border-y border-navy-100 bg-white py-4 dark:border-navy-800 dark:bg-navy-900"><Marquee items={data.map((s) => <><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{s.name}</>)} /></div>
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServiceTicker />
      <ServicesSection />
      <section id="estimate" className="section bg-gradient-to-b from-sky-soft/60 to-transparent dark:from-navy-900/40">
        <div className="container">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center"><span className="eyebrow">Moving cost estimator</span><h2 className="h-section mt-4">Know your <span className="text-gradient">estimated cost</span> in a minute</h2><p className="mt-4 text-navy-400">Estimates come from the business's configured rates. Your price is confirmed only in the itemised quotation.</p></Reveal>
          <Estimator />
        </div>
      </section>
      <HowItWorks />
      <WhyUs />
      <Locations />
      <AboutSection />
      <ReviewsSection />
      <FaqSection />
      <FinalCta />
    </>
  )
}
