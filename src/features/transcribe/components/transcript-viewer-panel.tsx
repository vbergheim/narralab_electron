import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Edit3, ExternalLink, Highlighter, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'

type ViewMode = 'preview' | 'edit'

export function TranscriptViewerPanel({
  text,
  title = 'Transcript',
  subtitle = null,
  editable = false,
  placeholder = 'Transcript will appear here…',
  emptyText = 'Empty transcript.',
  onTextChange,
  onDetach,
  toolbarActions,
}: {
  text: string
  title?: string
  subtitle?: string | null
  editable?: boolean
  placeholder?: string
  emptyText?: string
  onTextChange?(value: string): void
  onDetach?(): void
  toolbarActions?: ReactNode
}) {
  const [mode, setMode] = useState<ViewMode>('preview')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const [pinnedHighlightTerms, setPinnedHighlightTerms] = useState<string[]>([])
  const [highlightMode, setHighlightMode] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const searchRanges = useMemo(() => findTranscriptMatchRanges(text, searchQuery), [searchQuery, text])
  const normalizedSearchMatchIndex = useMemo(() => {
    if (searchRanges.length === 0) return -1
    const remainder = searchMatchIndex % searchRanges.length
    return remainder >= 0 ? remainder : remainder + searchRanges.length
  }, [searchMatchIndex, searchRanges.length])

  const highlightedContent = useMemo(
    () =>
      renderHighlightedTranscript(text, searchRanges, normalizedSearchMatchIndex, pinnedHighlightTerms),
    [text, searchRanges, normalizedSearchMatchIndex, pinnedHighlightTerms],
  )

  useEffect(() => {
    if (searchRanges.length === 0) {
      if (searchMatchIndex !== 0) {
        setSearchMatchIndex(0)
      }
      return
    }

    if (searchMatchIndex !== normalizedSearchMatchIndex) {
      setSearchMatchIndex(normalizedSearchMatchIndex)
    }
  }, [normalizedSearchMatchIndex, searchMatchIndex, searchRanges.length])

  useEffect(() => {
    if (normalizedSearchMatchIndex < 0 || !contentRef.current || mode !== 'preview') return
    const target = contentRef.current.querySelector<HTMLElement>(
      `[data-transcript-match="${normalizedSearchMatchIndex}"]`,
    )
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightedContent, mode, normalizedSearchMatchIndex])

  const addHighlightTerm = (selectedText: string) => {
    const normalized = normalizeHighlightedText(selectedText)
    if (!normalized) return
    setPinnedHighlightTerms((current) =>
      current.some((entry) => entry.toLocaleLowerCase() === normalized.toLocaleLowerCase())
        ? current
        : [...current, normalized],
    )
  }

  const captureSelectionHighlight = () => {
    if (!highlightMode) return
    const selectedText =
      mode === 'edit'
        ? readTextareaSelection(textareaRef.current, text)
        : readPreviewSelection(contentRef.current)
    addHighlightTerm(selectedText)
  }

  return (
    <Panel className="relative z-0 flex h-full min-h-[min(36vh,240px)] flex-col overflow-hidden lg:min-h-0">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/90 px-5 py-4">
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 truncate text-sm text-muted">{subtitle}</div>
          ) : null}
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          {editable ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setMode((current) => (current === 'edit' ? 'preview' : 'edit'))}
            >
              <Edit3 className="h-4 w-4" />
              {mode === 'edit' ? 'Done' : 'Edit'}
            </Button>
          ) : null}
          {toolbarActions}
          {onDetach ? (
            <Button variant="ghost" size="sm" type="button" onClick={onDetach}>
              <ExternalLink className="h-4 w-4" />
              Detach
            </Button>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setSearchMatchIndex(0)
              }}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter' && searchQuery.trim()) {
                  event.preventDefault()
                  setSearchMatchIndex((current) => (event.shiftKey ? current - 1 : current + 1))
                }
              }}
              className="pl-9"
              placeholder="Search transcript…"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={searchRanges.length === 0}
            onClick={() => setSearchMatchIndex((current) => current - 1)}
            aria-label="Previous match"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={searchRanges.length === 0}
            onClick={() => setSearchMatchIndex((current) => current + 1)}
            aria-label="Next match"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant={highlightMode ? 'accent' : 'ghost'}
            size="sm"
            type="button"
            disabled={!text.trim()}
            onClick={() => setHighlightMode((current) => !current)}
          >
            <Highlighter className="h-4 w-4" />
            {highlightMode ? 'Highlighting' : 'Highlight'}
          </Button>
          <div className="w-20 text-right text-xs text-muted">
            {searchRanges.length > 0 ? `${normalizedSearchMatchIndex + 1} / ${searchRanges.length}` : '0 / 0'}
          </div>
        </div>
        {pinnedHighlightTerms.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {pinnedHighlightTerms.map((term) => (
              <button
                key={term}
                type="button"
                className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-300/15"
                onClick={() =>
                  setPinnedHighlightTerms((current) => current.filter((entry) => entry !== term))
                }
                title="Remove highlight"
              >
                {term}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-panelMuted/10 px-5 py-4">
        {mode === 'edit' && editable ? (
          <Textarea
            ref={textareaRef}
            className="min-h-full resize-none rounded-2xl border border-border/70 bg-panel/85 font-mono text-sm leading-6 focus-visible:ring-0"
            value={text}
            onChange={(event) => onTextChange?.(event.target.value)}
            onSelect={captureSelectionHighlight}
            onKeyUp={captureSelectionHighlight}
            placeholder={placeholder}
          />
        ) : (
          <div
            ref={contentRef}
            className="whitespace-pre-wrap rounded-2xl border border-border/70 bg-panel/85 px-4 py-4 font-mono text-sm leading-6 text-foreground/90"
            onMouseUp={captureSelectionHighlight}
            onKeyUp={captureSelectionHighlight}
          >
            {text ? highlightedContent : emptyText}
          </div>
        )}
      </div>
    </Panel>
  )
}

function readTextareaSelection(textarea: HTMLTextAreaElement | null, text: string) {
  if (!textarea) return ''
  const { selectionStart, selectionEnd } = textarea
  if (selectionStart === selectionEnd) return ''
  return text.slice(selectionStart, selectionEnd)
}

function readPreviewSelection(container: HTMLElement | null) {
  if (!container || typeof window === 'undefined') return ''
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return ''
  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return ''
  return selection.toString()
}

function normalizeHighlightedText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function findTranscriptMatchRanges(text: string, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery || !text) return []

  const normalizedText = text.toLocaleLowerCase()
  const ranges: Array<{ start: number; end: number }> = []
  let startIndex = 0

  while (startIndex < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, startIndex)
    if (matchIndex === -1) break
    ranges.push({ start: matchIndex, end: matchIndex + normalizedQuery.length })
    startIndex = matchIndex + normalizedQuery.length
  }

  return ranges
}

function renderHighlightedTranscript(
  text: string,
  searchMatches: Array<{ start: number; end: number }>,
  activeMatchIndex: number,
  pinnedTerms: string[],
) {
  const pinRanges = pinnedTerms.flatMap((term) => findTranscriptMatchRanges(text, term))
  const ranges = [
    ...pinRanges.map((match) => ({ ...match, priority: 1 as const, style: 'pin' as const, matchIndex: -1 })),
    ...searchMatches.map((match, index) => ({
      ...match,
      priority: index === activeMatchIndex ? 3 as const : 2 as const,
      style: index === activeMatchIndex ? 'search-active' as const : 'search' as const,
      matchIndex: index,
    })),
  ]

  if (ranges.length === 0) return text

  const breakpoints = Array.from(new Set([0, text.length, ...ranges.flatMap((range) => [range.start, range.end])])).sort(
    (left, right) => left - right,
  )

  const nodes: ReactNode[] = []

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const start = breakpoints[index]!
    const end = breakpoints[index + 1]!
    if (start === end) continue

    const segmentText = text.slice(start, end)
    const covering = ranges
      .filter((range) => range.start < end && range.end > start)
      .sort((left, right) => right.priority - left.priority)
    const winner = covering[0]

    if (!winner) {
      nodes.push(segmentText)
      continue
    }

    nodes.push(
      <mark
        key={`segment:${start}:${end}`}
        data-transcript-match={winner.matchIndex >= 0 ? winner.matchIndex : undefined}
        className={highlightClassName(winner.style)}
      >
        {segmentText}
      </mark>,
    )
  }

  return nodes
}

function highlightClassName(style: 'pin' | 'search' | 'search-active') {
  if (style === 'search-active') {
    return 'rounded bg-accent px-0.5 text-accent-foreground'
  }

  if (style === 'search') {
    return 'rounded bg-accent/25 px-0.5 text-foreground'
  }

  return 'rounded bg-amber-300/20 px-0.5 text-amber-50'
}
