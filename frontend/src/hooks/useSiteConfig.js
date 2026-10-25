import { useEffect, useState } from 'react'
import { publicApi } from '../api/publicApi'

let cache = null
let inflight = null
const load = () => {
  if (cache) return Promise.resolve(cache)
  if (!inflight) inflight = publicApi.siteConfig().then((d) => { cache = d; return d }).finally(() => { inflight = null })
  return inflight
}
const EMPTY = { contact: {}, config: {}, content: {}, property_types: [], integrations: {} }

export function useSiteConfig() {
  const [cfg, setCfg] = useState(cache || EMPTY)
  const [loaded, setLoaded] = useState(!!cache)
  useEffect(() => { let on = true; load().then((d) => { if (on) { setCfg(d); setLoaded(true) } }).catch(() => on && setLoaded(true)); return () => { on = false } }, [])
  return { ...cfg, loaded }
}
