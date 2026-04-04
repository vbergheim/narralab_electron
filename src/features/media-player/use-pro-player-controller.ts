import { useCallback, useEffect, useMemo, useState } from 'react'

import type { MediaInspection } from '@/types/media'
import type { MediaPanelSource, MediaPlayerState, MediaPlayerViewport } from '@/types/media-player'

import { inferMediaPreviewKind, isInlinePreviewKind } from './media-player-utils'

type ControllerState = {
  inspection: MediaInspection | null
  loading: boolean
  mediaPlayerState: MediaPlayerState | null
  mediaPlayerBusy: boolean
  mediaPlayerError: string | null
  previewError: string | null
  proxyGenerating: boolean
  previewKind: MediaPanelSource['previewKind']
}

type ControllerActions = {
  setPreviewError(message: string | null): void
  createPreviewProxy(): Promise<void>
  openInProPlayer(): Promise<void>
  openInCurrentWindow(): Promise<void>
  openPlayerInstallGuide(): Promise<void>
  installProPlayer(): Promise<void>
  pauseProPlayer(): Promise<void>
  playProPlayer(): Promise<void>
  focusProPlayer(): Promise<void>
  closeProPlayer(): Promise<void>
  seekProPlayer(seconds: number): Promise<void>
  seekRelativeProPlayer(seconds: number): Promise<void>
  setVolumeProPlayer(volume: number): Promise<void>
  toggleFullscreenProPlayer(): Promise<void>
  setViewport(viewport: MediaPlayerViewport | null): Promise<void>
  detachCurrentWindow(): Promise<void>
}

export function useProPlayerController(source: MediaPanelSource | null): ControllerState & ControllerActions {
  const [inspection, setInspection] = useState<MediaInspection | null>(null)
  const [loading, setLoading] = useState(false)
  const [mediaPlayerState, setMediaPlayerState] = useState<MediaPlayerState | null>(null)
  const [mediaPlayerBusy, setMediaPlayerBusy] = useState(false)
  const [mediaPlayerError, setMediaPlayerError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [proxyGenerating, setProxyGenerating] = useState(false)

  const previewKind = useMemo(
    () => (source ? inferMediaPreviewKind(source, inspection) : 'other'),
    [inspection, source],
  )

  useEffect(() => {
    let cancelled = false

    void window.narralab.mediaPlayer.getState().then((state) => {
      if (!cancelled) setMediaPlayerState(state)
    })

    const dispose = window.narralab.mediaPlayer.subscribe((event) => {
      if (event.type === 'state') {
        setMediaPlayerState(event.payload)
      }
    })

    return () => {
      cancelled = true
      dispose()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!source) {
      setInspection(null)
      setLoading(false)
      setPreviewError(null)
      return
    }

    if (!source.exists || !isInlinePreviewKind(inferMediaPreviewKind(source, null))) {
      setInspection(null)
      setLoading(false)
      setPreviewError(null)
      return
    }

    setLoading(true)
    setPreviewError(null)
    void window.narralab.media.inspect([source.filePath])
      .then((result) => {
        if (cancelled) return
        setInspection(result[0] ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setInspection(null)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [source])

  const runMediaPlayerAction = useCallback(async (action: () => Promise<MediaPlayerState>, fallbackMessage: string) => {
    setMediaPlayerBusy(true)
    setMediaPlayerError(null)
    try {
      const nextState = await action()
      setMediaPlayerState(nextState)
    } catch (error) {
      setMediaPlayerError(error instanceof Error ? error.message : fallbackMessage)
    } finally {
      setMediaPlayerBusy(false)
    }
  }, [])

  const createPreviewProxy = useCallback(async () => {
    if (!source) return
    setProxyGenerating(true)
    setPreviewError(null)
    try {
      const nextInspection = await window.narralab.media.createPreviewProxy(source.filePath)
      setInspection(nextInspection)
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Could not generate preview proxy')
    } finally {
      setProxyGenerating(false)
    }
  }, [source])

  const openInProPlayer = useCallback(async () => {
    if (!source) return
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.open(source.filePath), 'Could not open Media Player')
  }, [runMediaPlayerAction, source])

  const openInCurrentWindow = useCallback(async () => {
    if (!source) return
    await runMediaPlayerAction(
      () => window.narralab.mediaPlayer.openInCurrentWindow(source.filePath),
      'Could not open Media Player',
    )
  }, [runMediaPlayerAction, source])

  const openPlayerInstallGuide = useCallback(async () => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.openInstallGuide(), 'Could not open install guide')
  }, [runMediaPlayerAction])

  const installProPlayer = useCallback(async () => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.install(), 'Could not install Media Player')
  }, [runMediaPlayerAction])

  const pauseProPlayer = useCallback(async () => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.pause(), 'Could not control Media Player')
  }, [runMediaPlayerAction])

  const playProPlayer = useCallback(async () => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.play(), 'Could not control Media Player')
  }, [runMediaPlayerAction])

  const focusProPlayer = useCallback(async () => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.focus(), 'Could not control Media Player')
  }, [runMediaPlayerAction])

  const closeProPlayer = useCallback(async () => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.close(), 'Could not control Media Player')
  }, [runMediaPlayerAction])

  const seekProPlayer = useCallback(async (seconds: number) => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.seek(seconds), 'Could not control Media Player')
  }, [runMediaPlayerAction])

  const seekRelativeProPlayer = useCallback(async (seconds: number) => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.seekRelative(seconds), 'Could not control Media Player')
  }, [runMediaPlayerAction])

  const setVolumeProPlayer = useCallback(async (volume: number) => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.setVolume(volume), 'Could not control Media Player')
  }, [runMediaPlayerAction])

  const toggleFullscreenProPlayer = useCallback(async () => {
    await runMediaPlayerAction(() => window.narralab.mediaPlayer.toggleFullscreen(), 'Could not control Media Player')
  }, [runMediaPlayerAction])

  const setViewport = useCallback(async (viewport: MediaPlayerViewport | null) => {
    try {
      const nextState = await window.narralab.mediaPlayer.setViewport(viewport)
      setMediaPlayerState(nextState)
    } catch {
      // Ignore transient viewport sync failures while the window is resizing.
    }
  }, [])

  const detachCurrentWindow = useCallback(async () => {
    try {
      const nextState = await window.narralab.mediaPlayer.detachCurrentWindow()
      setMediaPlayerState(nextState)
    } catch {
      // Ignore detach errors during window teardown.
    }
  }, [])

  return {
    inspection,
    loading,
    mediaPlayerState,
    mediaPlayerBusy,
    mediaPlayerError,
    previewError,
    proxyGenerating,
    previewKind,
    setPreviewError,
    createPreviewProxy,
    openInProPlayer,
    openInCurrentWindow,
    openPlayerInstallGuide,
    installProPlayer,
    pauseProPlayer,
    playProPlayer,
    focusProPlayer,
    closeProPlayer,
    seekProPlayer,
    seekRelativeProPlayer,
    setVolumeProPlayer,
    toggleFullscreenProPlayer,
    setViewport,
    detachCurrentWindow,
  }
}
