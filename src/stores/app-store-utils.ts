import { beginProjectAction, finishProjectAction } from '@/stores/project-action-state'
import type { AppStore, AppStoreSet } from '@/stores/app-store-contract'
import type { Board } from '@/types/board'
import type { BoardFolder } from '@/types/board'
import type { ShootLogImportResult } from '@/types/project'
import type { SceneBeat } from '@/types/scene'
import type { TagType } from '@/types/tag'

export function inferTagType(name: string): TagType {
  if (name.startsWith('@')) return 'character'
  if (name.startsWith('#')) return 'theme'
  if (name.startsWith('/')) return 'location'
  return 'general'
}

export function buildBoardOrderAfterMove(
  boards: Board[],
  folders: BoardFolder[],
  boardId: string,
  targetFolder: string,
  beforeBoardId: string | null,
) {
  const movedBoard = boards.find((board) => board.id === boardId)
  if (!movedBoard) {
    return boards.map((board) => board.id)
  }

  const remaining = boards.filter((board) => board.id !== boardId)
  const folderOrder = [''].concat(folders.map((folder) => folder.name))
  const normalizedTargetFolder = targetFolder.trim()

  if (beforeBoardId) {
    const insertIndex = remaining.findIndex((board) => board.id === beforeBoardId)
    if (insertIndex >= 0) {
      const next = [...remaining]
      next.splice(insertIndex, 0, { ...movedBoard, folder: normalizedTargetFolder })
      return next.map((board) => board.id)
    }
  }

  const next = [...remaining]
  const targetFolderIndex = Math.max(0, folderOrder.findIndex((folderName) => folderName === normalizedTargetFolder))
  const lastIndexInTarget = findLastIndex(next, (board) => board.folder === normalizedTargetFolder)

  if (lastIndexInTarget >= 0) {
    next.splice(lastIndexInTarget + 1, 0, { ...movedBoard, folder: normalizedTargetFolder })
    return next.map((board) => board.id)
  }

  const nextFolderIndex = next.findIndex((board) => {
    const boardFolderIndex = Math.max(0, folderOrder.findIndex((folderName) => folderName === board.folder))
    return boardFolderIndex > targetFolderIndex
  })

  if (nextFolderIndex >= 0) {
    next.splice(nextFolderIndex, 0, { ...movedBoard, folder: normalizedTargetFolder })
  } else {
    next.push({ ...movedBoard, folder: normalizedTargetFolder })
  }

  return next.map((board) => board.id)
}

export function sortBeats(beats: SceneBeat[]) {
  return [...beats].sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt))
}

export async function runProjectAction(
  set: AppStoreSet,
  action: () => Promise<void>,
) {
  set((state) => beginProjectAction(state as AppStore))

  try {
    await action()
  } catch (error) {
    set({ error: toMessage(error) })
  } finally {
    set((state) => finishProjectAction(state as AppStore))
  }
}

export function toMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

export function formatShootLogImportErrors(result: ShootLogImportResult) {
  const details = result.errors
    .slice(0, 6)
    .map((entry) => `${entry.sheet} row ${entry.row}: ${entry.message}`)
    .join('\n')
  const suffix = result.errors.length > 6 ? `\n...and ${result.errors.length - 6} more errors.` : ''

  return `Opptakslogg-import mislyktes.\n${details}${suffix}`
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index
    }
  }
  return -1
}
