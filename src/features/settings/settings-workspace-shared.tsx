import type { ReactNode } from 'react'

export function Header({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-display text-xl font-semibold text-foreground">{title}</div>
        <div className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</div>
      </div>
      {children}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
      {children}
    </label>
  )
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange(value: boolean): void
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/70 bg-panel px-3 py-2.5">
      <span className="text-sm text-foreground">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}
