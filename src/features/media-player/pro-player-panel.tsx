import type { ReactNode } from 'react'
import { Clock3, FileAudio2, Loader2, WandSparkles, TimerReset } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { MediaInspection } from '@/types/media'
import type { MediaPanelSource, MediaPlayerState } from '@/types/media-player'

import {
  formatDurationSeconds,
  formatFileSize,
  formatFrameRate,
  formatResolution,
  toFileUrl,
} from './media-player-utils'

type Props = {
  source: MediaPanelSource | null
  inspection: MediaInspection | null
  loading: boolean
  mediaPlayerState: MediaPlayerState | null
  mediaPlayerError: string | null
  previewError: string | null
  proxyGenerating: boolean
  onCreatePreviewProxy(): void
  onPreviewError(message: string | null): void
}

export function ProPlayerPanel({
  source,
  inspection,
  loading,
  mediaPlayerState,
  mediaPlayerError,
  previewError,
  proxyGenerating,
  onCreatePreviewProxy,
  onPreviewError,
}: Props) {
  if (!source) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-border/80 bg-panelMuted/20 p-8 text-center">
        <div>
          <div className="text-lg font-semibold text-foreground">No media selected</div>
          <div className="mt-2 text-sm text-muted">Select media anywhere in the app to preview it here.</div>
        </div>
      </div>
    )
  }

  const previewKind = source.previewKind
  const previewPath = inspection?.playbackPath ?? (previewKind === 'image' && source.exists ? source.filePath : null)
  const previewUrl = previewPath ? toFileUrl(previewPath) : null
  const canUseProPlayer = previewKind === 'video' || previewKind === 'audio'
  const playerAvailable = mediaPlayerState?.available ?? false

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border/80 px-4 py-4">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-medium text-foreground">{source.name}</div>
            <div className="mt-1 truncate text-xs text-muted">{source.filePath}</div>
          </div>

          {canUseProPlayer ? (
            <div className="space-y-1 text-xs text-muted">
              <div>
                {playerAvailable
                  ? 'Native mpv playback is available for this media.'
                  : mediaPlayerState?.status === 'installing'
                    ? 'Installing mpv…'
                    : 'mpv is required for native playback on this machine'}
              </div>
              {!playerAvailable && mediaPlayerState?.installHint ? <div>{mediaPlayerState.installHint}</div> : null}
              {mediaPlayerError ? <div className="text-red-200">{mediaPlayerError}</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-b border-border/80 p-4">
        <div className="overflow-hidden rounded-2xl bg-black/80">
          {loading ? (
            <div className="flex aspect-video items-center justify-center text-sm text-white/70">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reading media…
            </div>
          ) : !source.exists ? (
            <EmptyPreview message="File is missing on disk." />
          ) : previewKind === 'video' && previewUrl && !previewError ? (
            <video
              key={previewUrl}
              controls
              preload="metadata"
              className="aspect-video w-full bg-black"
              src={previewUrl}
              onError={() => onPreviewError('This video format is not supported directly by the built-in player. Generate a preview proxy to play it in-app.')}
            />
          ) : previewKind === 'audio' && previewUrl ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_transparent_55%),linear-gradient(180deg,rgba(37,46,58,0.85),rgba(8,10,16,0.96))] p-6 text-center">
              <FileAudio2 className="h-10 w-10 text-white/85" />
              <div className="text-sm text-white/75">{source.name}</div>
              <audio key={previewUrl} controls preload="metadata" className="w-full max-w-[280px]" src={previewUrl} />
            </div>
          ) : previewKind === 'video' && previewError ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%),linear-gradient(180deg,rgba(37,46,58,0.85),rgba(8,10,16,0.96))] px-6 text-center">
              <div className="max-w-sm text-sm text-white/75">{previewError}</div>
              <Button variant="default" size="sm" onClick={onCreatePreviewProxy} disabled={proxyGenerating}>
                {proxyGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                {proxyGenerating ? 'Generating Preview…' : 'Generate Preview Proxy'}
              </Button>
            </div>
          ) : previewKind === 'image' && previewUrl ? (
            <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%),linear-gradient(180deg,rgba(37,46,58,0.85),rgba(8,10,16,0.96))] p-4">
              <img src={previewUrl} alt={source.name} className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          ) : (
            <EmptyPreview message="No inline preview for this file type yet." />
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4 text-sm sm:grid-cols-2">
        <MetaField label="Type" value={previewKind === 'other' ? source.kindLabel : previewKind} />
        <MetaField label="Size" value={source.exists ? formatFileSize(source.fileSize) : 'Missing'} />
        <MetaField label="Playback" value={inspection?.playbackMode ?? (previewKind === 'image' ? 'direct' : 'unavailable')} />
        <MetaField label="Container" value={inspection?.containerFormat ?? (source.extension ? source.extension.toUpperCase() : 'Unknown')} />
        <MetaField label="Video Codec" value={inspection?.videoCodec ?? '—'} />
        <MetaField label="Audio Codec" value={inspection?.audioCodec ?? '—'} />
        <MetaField label="Resolution" value={formatResolution(inspection)} />
        <MetaField label="Frame Rate" value={formatFrameRate(inspection)} />
        <MetaField label="Duration" value={formatDurationSeconds(inspection?.durationSeconds ?? null)} icon={<Clock3 className="h-3.5 w-3.5" />} />
        <MetaField label="Timecode" value={inspection?.timecode ?? '—'} icon={<TimerReset className="h-3.5 w-3.5" />} />
      </div>
    </div>
  )
}

function EmptyPreview({ message }: { message: string }) {
  return (
    <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-white/70">
      {message}
    </div>
  )
}

function MetaField({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-panel/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  )
}
