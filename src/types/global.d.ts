import type { NarraLabApi } from './project'

declare global {
  interface Window {
    narralab: NarraLabApi & {
      boards?: {
        draggedBoardIds?: string[]
      }
    }
  }
}

export {}
