import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, CircleHelp, RotateCcw, Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import type { AppSettings, ConsultantMessage, ConsultantProactiveHint } from '@/types/ai'

type Props = {
  settings: AppSettings
  messages: ConsultantMessage[]
  busy: boolean
  contextSummary: string
  proactiveHint: ConsultantProactiveHint | null
  compact?: boolean
  onSend(content: string): void
  onClear(): void
  onOpenSettings(): void
}

export function ConsultantWorkspace({
  settings,
  messages,
  busy,
  contextSummary,
  proactiveHint,
  compact = false,
  onSend,
  onClear,
  onOpenSettings,
}: Props) {
  const [draft, setDraft] = useState('')
  const [showCompactHelp, setShowCompactHelp] = useState(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const hasConfiguredKey =
    settings.ai.provider === 'openai' ? settings.ai.hasOpenAiApiKey : settings.ai.hasGeminiApiKey

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [messages, busy])

  const submit = () => {
    const next = draft.trim()
    if (!next || busy) return
    onSend(next)
    setDraft('')
  }

  return (
    <div className={cn('grid h-full min-h-0 gap-4', compact ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1.4fr)_320px]')}>
      <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', compact ? '' : 'rounded-[28px] border border-border/90 bg-panel')}>
        {compact ? (
          <div className="flex items-center justify-between gap-3 px-1 pb-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setShowCompactHelp((current) => !current)} aria-label="Show consultant help">
                <CircleHelp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onOpenSettings} aria-label="Open consultant settings">
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClear} disabled={messages.length === 0 && !draft} aria-label="Clear conversation">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
        {!compact ? (
          <div className="flex items-center justify-between border-b border-border/90 px-5 py-4">
            <div>
              <div className="font-display text-xl font-semibold text-foreground">Consultant</div>
              <div className="mt-1 text-sm text-muted">
                Active provider: {settings.ai.provider === 'openai' ? 'OpenAI' : 'Gemini'}
                {' · '}
                Model: {settings.ai.provider === 'openai' ? settings.ai.openAiModel : settings.ai.geminiModel}
                {' · '}
                Focus: {contextSummary}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                <Settings2 className="h-4 w-4" />
                Settings
              </Button>
              <Button variant="ghost" size="sm" onClick={onClear} disabled={messages.length === 0 && !draft}>
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        <div
          ref={viewportRef}
          className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain bg-black/10', compact ? 'space-y-4 px-1 py-1' : 'space-y-4 px-5 py-5')}
        >
          {compact && showCompactHelp ? (
            <div className="rounded-2xl border border-border/90 bg-panelMuted/40 p-4 text-sm text-muted">
              Konsulenten bruker automatisk det du jobber med akkurat nå. Du kan spørre om struktur, svakheter, manglende scener eller be om konkrete forslag. Åpne fullt panel hvis du vil jobbe mer systematisk.
            </div>
          ) : null}
          {proactiveHint ? (
            <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-foreground">
              <div className="font-semibold">{proactiveHint.title}</div>
              <div className="mt-1 text-muted">{proactiveHint.reason}</div>
              <div className="mt-3">
                <Button variant="accent" size="sm" onClick={() => onSend(proactiveHint.prompt)} disabled={busy || !hasConfiguredKey}>
                  Be om forslag
                </Button>
              </div>
            </div>
          ) : null}

          {messages.length === 0 && !compact ? (
            <div className="rounded-2xl border border-border/90 bg-panelMuted/40 p-5 text-sm text-muted">
              Ask for structure notes, chapter ideas, missing scenes, VO placement, what feels repetitive, or how to sharpen the emotional line.
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex flex-col gap-1', message.role === 'user' ? 'items-end' : 'items-start')}
            >
              <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {message.role === 'user' ? 'You' : 'Consultant'}
                {' · '}
                {formatTime(message.createdAt)}
              </div>
              <div
                className={cn(
                  'max-w-[82%] rounded-[24px] px-5 py-4 text-sm leading-7 shadow-card whitespace-pre-wrap',
                  message.role === 'user'
                    ? 'border border-accent/40 bg-accent/12 text-foreground'
                    : message.error
                      ? 'border border-danger/40 bg-danger/10 text-red-100'
                      : 'border border-border bg-panel text-foreground',
                )}
              >
                {message.role === 'assistant' && !message.error
                  ? renderConsultantContent(message.content)
                  : message.content}
              </div>
            </div>
          ))}

          {busy ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-panelMuted px-4 py-3 text-sm text-muted">
                Thinking…
              </div>
            </div>
          ) : null}
        </div>

        <div className={cn(compact ? 'mt-5 px-1 pt-4' : 'border-t border-border/90 px-5 py-4')}>
          {!hasConfiguredKey ? (
            <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Add a {settings.ai.provider === 'openai' ? 'OpenAI' : 'Gemini'} API key in Settings before chatting.
            </div>
          ) : null}
          <div className={cn('flex items-end gap-3', compact ? 'rounded-[24px] bg-panel/50 p-2.5' : '')}>
            <Textarea
              className={cn('flex-1', compact ? 'min-h-[92px] rounded-[20px]' : 'min-h-[96px]')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submit()
                }
              }}
            />
            <Button className={cn(compact ? 'h-14 w-14 rounded-[20px] px-0' : '')} variant="accent" size="md" onClick={submit} disabled={busy || !hasConfiguredKey || !draft.trim()}>
              <ArrowUp className="h-4 w-4" />
              {!compact ? 'Send' : null}
            </Button>
          </div>
          {!compact ? (
            <div className="mt-2 text-xs text-muted">
              Enter sends. Shift + Enter adds a new line. Konsulenten bruker fokusert kontekst bare når du faktisk åpner og spør.
            </div>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <Panel className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            <Bot className="h-4 w-4 text-accent" />
            Best Use
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>Ask it to compare two board versions, spot weak transitions, propose chapter breaks or find missing scenes.</p>
            <p>Den følger arbeidsflaten og aktivt board automatisk, uten at du trenger å slå kontekst av og på.</p>
            <p>Enter sends quickly. Shift + Enter adds a new line.</p>
          </div>
        </Panel>
      ) : null}
    </div>
  )
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatConsultantContent(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[*-]\s+/gm, '• ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderConsultantContent(value: string): ReactNode {
  const normalized = formatConsultantContent(value)
  const lines = normalized.split('\n')
  const blocks: Array<
    | { type: 'paragraph'; content: string }
    | { type: 'ordered'; items: string[] }
    | { type: 'unordered'; items: string[] }
  > = []

  let paragraphBuffer: string[] = []

  const flushParagraph = () => {
    const content = paragraphBuffer.join(' ').trim()
    if (content) {
      blocks.push({ type: 'paragraph', content })
    }
    paragraphBuffer = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()

    if (!line) {
      flushParagraph()
      continue
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph()
      const items = [orderedMatch[2].trim()]
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1].trim()
        const nextMatch = nextLine.match(/^\d+\.\s+(.*)$/)
        if (!nextMatch) break
        items.push(nextMatch[1].trim())
        index += 1
      }
      blocks.push({ type: 'ordered', items })
      continue
    }

    const unorderedMatch = line.match(/^•\s+(.*)$/)
    if (unorderedMatch) {
      flushParagraph()
      const items = [unorderedMatch[1].trim()]
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1].trim()
        const nextMatch = nextLine.match(/^•\s+(.*)$/)
        if (!nextMatch) break
        items.push(nextMatch[1].trim())
        index += 1
      }
      blocks.push({ type: 'unordered', items })
      continue
    }

    paragraphBuffer.push(line)
  }

  flushParagraph()

  return (
    <div className="space-y-3 whitespace-normal">
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p key={`paragraph-${index}`} className="text-sm leading-6 text-inherit">
              {block.content}
            </p>
          )
        }

        if (block.type === 'ordered') {
          return (
            <ol key={`ordered-${index}`} className="space-y-2 pl-5 text-sm leading-6 text-inherit">
              {block.items.map((item, itemIndex) => (
                <li key={`ordered-item-${itemIndex}`} className="pl-1">
                  {item}
                </li>
              ))}
            </ol>
          )
        }

        return (
          <ul key={`unordered-${index}`} className="space-y-2 pl-5 text-sm leading-6 text-inherit">
            {block.items.map((item, itemIndex) => (
              <li key={`unordered-item-${itemIndex}`} className="pl-1">
                {item}
              </li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
