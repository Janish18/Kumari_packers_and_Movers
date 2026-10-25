import { useEffect, useState } from 'react'
import { publicApi } from '../api/publicApi'

let cache = null
export function useAreas() {
  const [areas, setAreas] = useState(cache || [])
  const [loading, setLoading] = useState(!cache)
  useEffect(() => { if (!cache) publicApi.areas().then((d) => { cache = d; setAreas(d) }).catch(() => {}).finally(() => setLoading(false)) }, [])
  return { areas, loading }
}

/** Coverage of a city against configured areas: 'SERVICEABLE' | 'MANUAL' | 'UNKNOWN' | null (empty input). */
export function coverageOf(areas, city) {
  const c = (city || '').trim().toLowerCase()
  if (!c) return null
  const hit = areas.find((a) => a.city.toLowerCase() === c)
  return hit ? hit.coverage : 'UNKNOWN'
}
