import { Badge } from './Feedback'
import { STATUS } from '../../utils/format'

const LIVE = new Set(['EN_ROUTE_TO_PICKUP', 'LOADING', 'IN_TRANSIT', 'UNLOADING'])
export default function StatusBadge({ status, label }) {
  const s = STATUS[status] || { label: status, tone: 'slate' }
  return <Badge tone={s.tone} dot={LIVE.has(status)}>{label || s.label}</Badge>
}
