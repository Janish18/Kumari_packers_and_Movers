import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Check, Clock, FileText, Info } from 'lucide-react'
import { Badge } from '../common/Feedback'
import Button from '../common/Button'
import { date, dateTime, money } from '../../utils/format'

export function AddressBlock({ title, line1, city, pincode, floor, elevator, parking, tone = 'navy' }) {
  return (
    <div className="rounded-xl border border-navy-100 p-4 dark:border-navy-800">
      <p className={clsx('mb-2 text-xs font-bold uppercase tracking-widest', tone === 'brand' ? 'text-brand-500' : 'text-navy-400')}>{title}</p>
      <p className="font-semibold">{line1}</p>
      <p className="text-sm text-navy-400">{city}{pincode ? ` - ${pincode}` : ''}</p>
      <p className="mt-2 text-xs text-navy-400">Floor {floor ?? 0} · {elevator ? 'Lift available' : 'No lift'}{parking ? ` · Parking: ${parking}` : ''}</p>
    </div>
  )
}

export function InventoryTable({ items }) {
  if (!items?.length) return <p className="text-sm text-navy-400">No inventory was added.</p>
  const rooms = items.reduce((m, i) => ({ ...m, [i.room]: [...(m[i.room] || []), i] }), {})
  return (
    <div className="space-y-4">
      {Object.entries(rooms).map(([room, rows]) => (
        <div key={room}><p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-navy-400">{room}</p>
          <ul className="divide-y divide-navy-100 rounded-xl border border-navy-100 dark:divide-navy-800 dark:border-navy-800">
            {rows.map((r) => <li key={r.id ?? r.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span>{r.name}{r.is_fragile && <Badge tone="amber" className="ml-2">Fragile</Badge>}{r.notes && <span className="ml-2 text-xs text-navy-400">{r.notes}</span>}</span><span className="font-semibold">×{r.quantity}</span></li>)}
          </ul></div>
      ))}
    </div>
  )
}

const QTONE = { SENT: 'amber', ACCEPTED: 'green', SUPERSEDED: 'slate', EXPIRED: 'red' }
export function QuotationCard({ q, onAccept, accepting, canAccept, highlight }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={clsx('overflow-hidden rounded-2xl border', highlight ? 'border-brand-300 shadow-glow' : 'border-navy-100 dark:border-navy-800')}>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-navy-50/70 px-5 py-3 dark:bg-navy-800/60">
        <p className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4 text-brand-500" />Quotation v{q.version}</p>
        <Badge tone={QTONE[q.status]}>{q.status === 'SENT' ? 'Awaiting your decision' : q.status.charAt(0) + q.status.slice(1).toLowerCase()}</Badge>
      </div>
      <div className="px-5 py-4">
        <table className="w-full text-sm"><tbody className="divide-y divide-navy-100 dark:divide-navy-800">
          {q.lines.map((l) => <tr key={l.id}><td className="py-2 pr-3">{l.label}{Number(l.quantity) !== 1 && <span className="ml-1 text-xs text-navy-400">({Number(l.quantity)} × {money(l.unit_price)})</span>}</td><td className="py-2 text-right font-semibold tabular-nums">{money(l.line_total)}</td></tr>)}
        </tbody></table>
        <dl className="mt-3 space-y-1.5 border-t border-dashed border-navy-200 pt-3 text-sm dark:border-navy-700">
          <div className="flex justify-between"><dt className="text-navy-400">Subtotal</dt><dd className="tabular-nums">{money(q.subtotal)}</dd></div>
          {Number(q.discount) > 0 && <div className="flex justify-between text-emerald-600"><dt>Discount{q.discount_reason ? ` (${q.discount_reason})` : ''}</dt><dd className="tabular-nums">-{money(q.discount)}</dd></div>}
          {Number(q.gst) > 0 && <div className="flex justify-between"><dt className="text-navy-400">GST ({Number(q.gst_percent)}%)</dt><dd className="tabular-nums">{money(q.gst)}</dd></div>}
          <div className="flex justify-between border-t border-navy-100 pt-2 text-lg font-extrabold dark:border-navy-800"><dt>Total</dt><dd className="tabular-nums text-brand-600">{money(q.total)}</dd></div>
        </dl>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-400"><Clock className="h-3.5 w-3.5" />Valid until {date(q.valid_until)}{q.is_expired && q.status === 'SENT' ? ' (expired)' : ''}</p>
        {q.notes && <p className="mt-2 flex gap-1.5 rounded-lg bg-navy-50 p-3 text-xs dark:bg-navy-800"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{q.notes}</p>}
        {canAccept && q.status === 'SENT' && <Button size="lg" shine icon={Check} className="mt-5 w-full" loading={accepting} onClick={() => onAccept(q)}>Accept this quotation</Button>}
      </div>
    </motion.div>
  )
}

const PTONE = { SUCCESS: 'green', PENDING: 'amber', CREATED: 'slate', FAILED: 'red', REFUNDED: 'blue', PARTIALLY_REFUNDED: 'blue' }
export function PaymentList({ payments }) {
  if (!payments?.length) return <p className="text-sm text-navy-400">No payments yet.</p>
  return <ul className="divide-y divide-navy-100 dark:divide-navy-800">{payments.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">{p.kind.charAt(0) + p.kind.slice(1).toLowerCase()} payment</p><p className="text-xs text-navy-400">{dateTime(p.created_at)}</p></div><div className="text-right"><p className="font-bold tabular-nums">{money(p.amount)}</p><Badge tone={PTONE[p.status]}>{p.status.replace('_', ' ').toLowerCase()}</Badge></div></li>)}</ul>
}
