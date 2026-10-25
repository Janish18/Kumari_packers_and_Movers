import { useEffect, useRef, useState } from 'react'

export function useInView({ once = true, margin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); if (once) io.disconnect() } else if (!once) setInView(false)
    }, { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [once, margin])
  return [ref, inView]
}
