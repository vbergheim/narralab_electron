# Media Player Rollback Notes

**Date**: 2026-04-05  
**Status**: Runtime is back to stable `mpv + OSC`

## Purpose

This document explains the current media-player architecture after rolling back the experimental native embed work.

The goal is to keep playback robust now, while preserving the isolation needed for a future custom control surface.

## What Is Active In Runtime

The active playback path is:

- `Archive` or any other caller requests playback directly
- the caller resolves the selected media source
- `MediaPlayerService` launches `mpv`
- `mpv` runs as its own window with `OSC` enabled
- the app uses IPC only for open, focus, close, and basic playback state

The dedicated `pro-player` workspace is no longer part of the visible navigation. Media now opens directly into `mpv` from the app instead of first showing a separate player UI.

This is the stable path. It is the only path that should be used by default.

## What Was Rolled Back

The following experiment was disabled from runtime:

- `mpv` embedded into the Electron window on macOS
- Cocoa / `NSView` bridge code for same-window rendering
- viewport sync logic that tried to drive native rendering inside the app shell

Those files may still exist in the repository as historical work, but they are not part of the active playback path.

## What Was Kept On Purpose

The following layers are still useful and should be preserved:

- `MediaPlayerService` as the single main-process API for player actions
- the `mediaPlayer:*` IPC boundary
- `MediaPlayerState` and `MediaPanelSource` as shared contracts
- `useProPlayerController` as the renderer-side controller hook
- the media-preview panel and player launcher wiring used by `Archive`
- the mpv install flow for users who do not already have `mpv`

These layers let us add a custom player UI later without redesigning the whole app again.

## Current Behavior

- `mpv` is launched in its own window.
- A lightweight `ModernZ` skin is installed automatically when possible; otherwise mpv falls back to the stock `OSC`.
- Timecode is shown by default through the bundled `mpv-timecode.lua` script, which also toggles on/off with `Ctrl+t`.
- For pro formats, the app reads embedded start timecode with `ffprobe` in the main process and passes it into the mpv script so the display does not start at zero.
- The app can open, focus, close, pause, play, seek, change volume, and toggle fullscreen through IPC.
- There is no dedicated media-player workspace in the visible navigation; media opens directly in `mpv`.

## Why This Is The Default

This is the most robust version we tested:

- fewer moving parts
- less native macOS integration risk
- no fragile window embedding
- no black-screen / hang behavior from the earlier bridge path
- easy to open from multiple places in the app

## Future Custom Controls

If we want our own look later, the safest path is:

1. keep `MediaPlayerService` and the IPC boundary
2. replace only the UI layer
3. keep `mpv` as the playback engine until a stronger native rendering plan is needed

That means the future work should focus on a new player UI, not on reintroducing window embedding by default.

## Takeover Notes

If someone takes over this part of the app later, start here:

- `electron/main/media-player-service.ts`
- `electron/main/ipc.ts`
- `electron/preload/api.ts`
- `src/types/media-player.ts`
- `src/features/media-player/use-pro-player-controller.ts`
- `src/features/media-player/pro-player-workspace.tsx`

The experimental native files are not required for normal operation and should be treated as archive material unless there is a deliberate decision to continue the native embed experiment.
