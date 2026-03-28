import type { SceneColor } from './scene'

export type BoardItemKind = 'scene' | 'chapter' | 'voiceover' | 'narration' | 'text-card' | 'note'
export type BoardTextItemKind = Exclude<BoardItemKind, 'scene'>

type BoardItemBase = {
  id: string
  boardId: string
  kind: BoardItemKind
  position: number
  createdAt: string
  updatedAt: string
}

export type BoardSceneItem = BoardItemBase & {
  kind: 'scene'
  sceneId: string
  title?: never
  body?: never
  color?: never
}

export type BoardTextItem = BoardItemBase & {
  kind: BoardTextItemKind
  sceneId?: null
  title: string
  body: string
  color: SceneColor
}

export type BoardItem = BoardSceneItem | BoardTextItem

export type Board = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  items: BoardItem[]
}

export type AddSceneToBoardResult = {
  item: BoardSceneItem
  existed: boolean
}

export type BoardItemUpdateInput = {
  id: string
  kind?: BoardTextItemKind
  title?: string
  body?: string
  color?: SceneColor
}

export function isSceneBoardItem(item: BoardItem): item is BoardSceneItem {
  return item.kind === 'scene'
}

export function isTextBoardItem(item: BoardItem): item is BoardTextItem {
  return item.kind !== 'scene'
}
