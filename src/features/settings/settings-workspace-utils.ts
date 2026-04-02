export function normalizeBoardView(value: 'outline' | 'timeline' | 'canvas' | 'board') {
  if (value === 'timeline') return 'outline'
  if (value === 'board') return 'canvas'
  return value
}

export function swap<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) {
    return items
  }
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export const selectClassName =
  'h-10 w-full appearance-none rounded-xl border border-border bg-panel pl-3 pr-10 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20 bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20stroke%3D%27%236b7280%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%271.5%27%20d%3D%27m6%208%204%204%204-4%27%2F%3E%3C%2Fsvg%3E")] bg-[position:right_0.5rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat'
