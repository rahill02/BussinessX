export default function SectionLabel({ children, right }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">{children}</p>
      {right}
    </div>
  )
}
