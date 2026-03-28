import { useState } from 'react'
import { AlertTriangle, Layers3 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { sceneColors, sceneStatuses } from '@/lib/constants'
import type { Scene } from '@/types/scene'

type Props = {
  count: number
  onApply(input: {
    category?: string
    status?: Scene['status']
    color?: Scene['color']
  }): void
  onClear(): void
}

export function BulkSceneInspector({ count, onApply, onClear }: Props) {
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<Scene['status'] | ''>('')
  const [color, setColor] = useState<Scene['color'] | ''>('')

  return (
    <Panel className="h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/90 px-4 py-4">
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            Bulk Edit
          </div>
          <div className="mt-1 text-sm text-muted">Apply shared settings to the selected scene bank rows.</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear Selection
        </Button>
      </div>

      <div className="h-[calc(100%-78px)] overflow-y-auto p-4">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Changes here apply to <strong>{count}</strong> scenes at once.
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Category</div>
          <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Leave blank to keep existing categories" />
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Status</div>
          <select
            className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none"
            value={status}
            onChange={(event) => setStatus(event.target.value as Scene['status'] | '')}
          >
            <option value="">Keep current status</option>
            {sceneStatuses.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Color</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-label="Keep current color"
              title="Keep current color"
              onClick={() => setColor('')}
              className={`flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-xs transition ${
                color === '' ? 'border-accent/70 ring-2 ring-accent/30' : 'border-border/80 hover:border-foreground/30'
              }`}
            >
              Keep
            </button>
            {sceneColors.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-label={entry.label}
                title={entry.label}
                onClick={() => setColor(entry.value)}
                className={`h-9 w-9 rounded-full border transition ${
                  color === entry.value ? 'border-accent/70 ring-2 ring-accent/30' : 'border-border/80 hover:border-foreground/30'
                }`}
                style={{ backgroundColor: entry.hex }}
              >
                <span className="sr-only">{entry.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Button
            variant="accent"
            onClick={() =>
              onApply({
                category: category.trim() || undefined,
                status: status || undefined,
                color: color || undefined,
              })
            }
          >
            <Layers3 className="h-4 w-4" />
            Apply To {count} Scenes
          </Button>
          <Badge>Scene Bank only</Badge>
        </div>
      </div>
    </Panel>
  )
}
