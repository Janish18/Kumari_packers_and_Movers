import { useCallback, useEffect, useRef, useState } from 'react'

/** Fetch helper exposing real loading / error / data states. `fn` must return a promise. */
export function useApi(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null })
  const seq = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fnRef.current()
      if (id === seq.current) setState({ data, loading: false, error: null })
      return data
    } catch (error) {
      if (id === seq.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error }))
      return null
    }
  }, [])

  useEffect(() => {
    if (enabled) run()
    return () => { seq.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) }
}
