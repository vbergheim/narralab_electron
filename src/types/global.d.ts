import type { NarraLabApi } from './project'

declare global {
  interface Window {
    narralab: NarraLabApi
    /** Ephemeral board drag payload (board manager); not part of the stable IPC surface. */
    narralabBoardDrag?: { draggedBoardIds: string[] }
  }
}

export {}
