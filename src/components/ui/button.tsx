import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium transition duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-border bg-panel text-foreground hover:bg-panelMuted',
        accent: 'border-transparent bg-accent/90 text-white hover:bg-accent',
        ghost: 'border-transparent bg-transparent text-muted hover:bg-panelMuted hover:text-foreground',
        danger: 'border-danger/40 bg-danger/10 text-red-200 hover:bg-danger/20',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: Props) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
