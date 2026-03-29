import type { FocusEvent, KeyboardEvent, ReactNode, Ref } from 'react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'

export const inlineEditorClassName =
  'rounded-none border-x-0 border-t-0 border-b border-border/80 bg-transparent px-0 shadow-none focus-visible:border-foreground/40 focus-visible:ring-0'

function shouldSubmitOnBlur<T extends HTMLElement>(event: FocusEvent<T>) {
  const nextTarget = event.relatedTarget
  if (!(nextTarget instanceof HTMLElement)) {
    return true
  }

  const scope = event.currentTarget.closest('[data-inline-edit-scope="true"]')
  if (!scope) {
    return true
  }

  return !scope.contains(nextTarget)
}

function isHandledByScope(element: HTMLElement) {
  return Boolean(element.closest('[data-inline-edit-scope="true"]'))
}

export function InlineEditScope({
  children,
  className,
  stopPropagation = false,
  onSubmit,
  onCancel,
}: {
  children: ReactNode
  className?: string
  stopPropagation?: boolean
  onSubmit(): void
  onCancel?(): void
}) {
  return (
    <div
      data-inline-edit-scope="true"
      className={className}
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      onBlurCapture={(event) => {
        if (shouldSubmitOnBlur(event)) {
          onSubmit()
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancel?.()
        }
      }}
    >
      {children}
    </div>
  )
}

export function InlineNameEditor({
  value,
  placeholder,
  autoFocus = false,
  className,
  inputRef,
  onChange,
  onSubmit,
  onEnterKey,
  onCancel,
}: {
  value: string
  placeholder?: string
  autoFocus?: boolean
  className?: string
  inputRef?: Ref<HTMLInputElement>
  onChange(value: string): void
  onSubmit(): void
  onEnterKey?(): void
  onCancel?(): void
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (onEnterKey) {
        onEnterKey()
        return
      }
      onSubmit()
    }

    if (event.key === 'Escape') {
      if (isHandledByScope(event.currentTarget)) {
        return
      }
      event.preventDefault()
      onCancel?.()
    }
  }

  return (
    <Input
      ref={inputRef}
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      onPointerDownCapture={(event) => event.stopPropagation()}
      onMouseDownCapture={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDownCapture={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        if (isHandledByScope(event.currentTarget)) {
          return
        }
        if (shouldSubmitOnBlur(event)) {
          onSubmit()
        }
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        `h-8 text-sm ${inlineEditorClassName}`,
        className,
      )}
    />
  )
}

export function InlineTextareaEditor({
  value,
  placeholder,
  autoFocus = false,
  className,
  textareaRef,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string
  placeholder?: string
  autoFocus?: boolean
  className?: string
  textareaRef?: Ref<HTMLTextAreaElement>
  onChange(value: string): void
  onSubmit(): void
  onCancel?(): void
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      onSubmit()
    }

    if (event.key === 'Escape') {
      if (isHandledByScope(event.currentTarget)) {
        return
      }
      event.preventDefault()
      onCancel?.()
    }
  }

  return (
    <Textarea
      ref={textareaRef}
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      onPointerDownCapture={(event) => event.stopPropagation()}
      onMouseDownCapture={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDownCapture={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        if (isHandledByScope(event.currentTarget)) {
          return
        }
        if (shouldSubmitOnBlur(event)) {
          onSubmit()
        }
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        `min-h-[80px] resize-none py-2 text-sm ${inlineEditorClassName}`,
        className,
      )}
    />
  )
}
