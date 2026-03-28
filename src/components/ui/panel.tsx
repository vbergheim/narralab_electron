import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-border/90 bg-panel/95 shadow-card backdrop-blur',
        className,
      )}
      {...props}
    />
  ),
)

Panel.displayName = 'Panel'
