const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export const money = (v, whole = false) => (v === null || v === undefined || v === '' ? '-' : (whole ? inr0 : inr).format(Number(v)))

export function date(v, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!v) return '-'
  const d = typeof v === 'string' && v.length === 10 ? new Date(`${v}T00:00:00`) : new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', opts)
}
export const dateTime = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-')

export function timeAgo(v) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(v).getTime()) / 1000))
  const steps = [[60, 's'], [60, 'm'], [24, 'h'], [30, 'd']]
  let n = s
  for (const [div, unit] of steps) { if (n < div) return `${n}${unit} ago`; n = Math.floor(n / div) }
  return date(v)
}

export const today = () => new Date().toISOString().slice(0, 10)
export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export const STATUS = {
  DRAFT: { label: 'Draft', tone: 'slate' },
  QUOTE_REQUESTED: { label: 'Quote requested', tone: 'blue' },
  QUOTE_PREPARED: { label: 'Quote ready', tone: 'amber' },
  QUOTE_ACCEPTED: { label: 'Quote accepted', tone: 'indigo' },
  CONFIRMED: { label: 'Confirmed', tone: 'teal' },
  DRIVER_ASSIGNED: { label: 'Driver assigned', tone: 'teal' },
  EN_ROUTE_TO_PICKUP: { label: 'En route to pickup', tone: 'orange' },
  LOADING: { label: 'Loading', tone: 'orange' },
  IN_TRANSIT: { label: 'In transit', tone: 'orange' },
  UNLOADING: { label: 'Unloading', tone: 'orange' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  EXCEPTION_REQUIRES_REVIEW: { label: 'Needs review', tone: 'red' },
}
export const JOURNEY = ['QUOTE_REQUESTED', 'QUOTE_PREPARED', 'QUOTE_ACCEPTED', 'CONFIRMED', 'DRIVER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'LOADING', 'IN_TRANSIT', 'UNLOADING', 'COMPLETED']

/** Extract a user-safe message from an API error. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  if (err.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
  if (!err.response) return 'Cannot reach the server. Check your connection and that the API is running.'
  const e = err.response.data?.error
  if (e?.details && typeof e.details === 'object') {
    const first = Object.values(e.details).flat()[0]
    if (typeof first === 'string') return first
  }
  return e?.message || fallback
}

/** Push server-side field errors into react-hook-form. Returns true if any field matched. */
export function applyFieldErrors(err, setError, fields = []) {
  const d = err?.response?.data?.error?.details
  if (!d || typeof d !== 'object') return false
  let hit = false
  Object.entries(d).forEach(([k, v]) => {
    if (!fields.length || fields.includes(k)) {
      setError(k, { type: 'server', message: [].concat(v).join(' ') })
      hit = true
    }
  })
  return hit
}

export const roleHome = (role) => ({ CUSTOMER: '/app', ADMIN: '/admin', DRIVER: '/driver' }[role] || '/login')
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?'
