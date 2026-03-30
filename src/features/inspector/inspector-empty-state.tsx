import type { ReactNode } from 'react'
import { PanelRightClose } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'

type Props = {
  title: string
  description: string
  body: ReactNode
  onCollapse?(): void
}

export function InspectorEmptyState({ title, description, body, onCollapse }: Props) {
  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/90 px-4 py-4">
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            {title}
          </div>
          <div className="mt-1 text-sm text-muted">{description}</div>
        </div>
        {onCollapse ? (
          <Button variant="ghost" size="sm" onClick={onCollapse} title="Collapse inspector" aria-label="Collapse inspector">
            <PanelRightClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-sm text-sm text-muted">{body}</div>
      </div>
    </Panel>
  )
}
