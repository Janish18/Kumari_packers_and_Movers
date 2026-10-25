import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, animate } from 'framer-motion'
import clsx from 'clsx'
import { useInView } from '../../hooks/useInView'

const EASE = [0.22, 1, 0.36, 1]

/** Scroll-triggered reveal. direction: up | down | left | right | none | scale */
export function Reveal({ children, delay = 0, direction = 'up', distance = 28, className, as = 'div', once = true }) {
  const reduce = useReducedMotion()
  const from = { opacity: 0, y: direction === 'up' ? distance : direction === 'down' ? -distance : 0, x: direction === 'left' ? distance : direction === 'right' ? -distance : 0, scale: direction === 'scale' ? 0.92 : 1 }
  const Comp = motion[as] || motion.div
  return (
    <Comp className={className} initial={reduce ? false : from} whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }} viewport={{ once, margin: '0px 0px -12% 0px' }} transition={{ duration: 0.75, delay, ease: EASE }}>
      {children}
    </Comp>
  )
}

export function Stagger({ children, className, gap = 0.08, delay = 0 }) {
  return (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}>
      {children}
    </motion.div>
  )
}
export function StaggerItem({ children, className, y = 24 }) {
  return <motion.div className={className} variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } } }}>{children}</motion.div>
}

/** Word-by-word masked headline reveal. `lines` is an array of strings or [{text, className}] segments. */
export function SplitHeadline({ lines, className, delay = 0.1, as = 'h1' }) {
  const Tag = motion[as]
  let n = 0
  return (
    <Tag className={className} initial="hidden" animate="show" aria-label={lines.map((l) => (typeof l === 'string' ? l : l.text)).join(' ')}>
      {lines.map((line, li) => {
        const text = typeof line === 'string' ? line : line.text
        const cls = typeof line === 'string' ? '' : line.className
        return (
          <span key={li} className="block" aria-hidden>
            {text.split(' ').map((w, wi) => (
              <span key={wi} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
                <motion.span className={clsx('inline-block pr-[0.25em]', cls)} variants={{ hidden: { y: '110%', rotate: 4 }, show: { y: 0, rotate: 0, transition: { duration: 0.8, ease: EASE, delay: delay + 0.07 * n++ } } }}>{w}</motion.span>
              </span>
            ))}
          </span>
        )
      })}
    </Tag>
  )
}

/** Counts up to a REAL value passed in (never invent numbers). Formats with `format`. */
export function AnimatedCounter({ value, format = (v) => Math.round(v).toLocaleString('en-IN'), duration = 1.4, className }) {
  const [ref, inView] = useInView()
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? Number(value) : 0)
  useEffect(() => {
    const target = Number(value) || 0
    if (reduce || !inView) { if (reduce) setShown(target); return undefined }
    const c = animate(0, target, { duration, ease: EASE, onUpdate: setShown })
    return () => c.stop()
  }, [value, inView, reduce, duration])
  return <span ref={ref} className={className}>{format(shown)}</span>
}

/** Pointer-follow 3D tilt. Disabled for touch / reduced motion. */
export function TiltCard({ children, className, max = 8 }) {
  const reduce = useReducedMotion()
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 })
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 })
  const onMove = (e) => {
    if (reduce || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2)
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2)
  }
  const reset = () => { rx.set(0); ry.set(0) }
  return <motion.div onPointerMove={onMove} onPointerLeave={reset} style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }} className={className}>{children}</motion.div>
}

/** Button/element that gently follows the pointer (desktop only). */
export function Magnetic({ children, strength = 0.25, className }) {
  const reduce = useReducedMotion()
  const x = useSpring(useMotionValue(0), { stiffness: 250, damping: 16 })
  const y = useSpring(useMotionValue(0), { stiffness: 250, damping: 16 })
  return (
    <motion.div className={clsx('inline-block', className)} style={{ x, y }}
      onPointerMove={(e) => { if (reduce || e.pointerType === 'touch') return; const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * strength); y.set((e.clientY - r.top - r.height / 2) * strength) }}
      onPointerLeave={() => { x.set(0); y.set(0) }}>
      {children}
    </motion.div>
  )
}

/** Soft spotlight that follows the cursor inside a section. Hidden on touch devices. */
export function CursorGlow({ children, className, color = 'rgba(255,107,53,.18)' }) {
  const ref = useRef(null)
  const onMove = (e) => {
    if (e.pointerType === 'touch' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`)
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div ref={ref} onPointerMove={onMove} className={clsx('group/glow relative', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-500 group-hover/glow:opacity-100 [@media(hover:hover)]:block"
        style={{ background: `radial-gradient(520px circle at var(--mx,50%) var(--my,50%), ${color}, transparent 60%)` }} />
      {children}
    </div>
  )
}

/** Subtle scroll parallax for decorative layers. */
export function Parallax({ children, speed = 0.15, className }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [-120 * speed * 4, 120 * speed * 4])
  return <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>{children}</motion.div>
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, restDelta: 0.001 })
  return <motion.div aria-hidden style={{ scaleX }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-brand-400 via-brand-500 to-amber-400" />
}

export function Marquee({ items, className }) {
  const list = [...items, ...items]
  return (
    <div className={clsx('relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]', className)}>
      <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
        {list.map((it, i) => <span key={i} className="flex items-center gap-3 whitespace-nowrap text-sm font-semibold text-navy-400">{it}</span>)}
      </div>
    </div>
  )
}

export function PageTransition({ children }) {
  return <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>{children}</motion.div>
}

/** Floating decorative blobs / aurora for hero backgrounds. */
export function Aurora({ className }) {
  return (
    <div aria-hidden className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute -left-24 top-10 h-96 w-96 animate-aurora rounded-full bg-brand-500/30 blur-[110px]" />
      <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] animate-aurora rounded-full bg-navy-400/40 blur-[120px] [animation-delay:-6s]" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-aurora rounded-full bg-amber-400/20 blur-[100px] [animation-delay:-12s]" />
    </div>
  )
}
