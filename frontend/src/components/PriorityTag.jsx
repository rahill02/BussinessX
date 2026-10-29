import { PRIORITY } from '../utils/buyFormat.js'

export default function PriorityTag({ priority }) {
  const p = PRIORITY[priority]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${p.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  )
}
