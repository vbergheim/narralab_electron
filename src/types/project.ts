import type {
  AddSceneToBoardResult,
  Board,
  BoardItem,
  BoardItemKind,
  BoardItemUpdateInput,
  BoardTextItem,
} from './board'
import type { Scene, SceneUpdateInput } from './scene'
import type { Tag, TagType } from './tag'

export type ProjectMeta = {
  path: string
  name: string
}

export type NotebookDocument = {
  content: string
  updatedAt: string | null
}

export type ProjectSnapshotV1 = {
  schemaVersion: 1
  exportedAt: string
  project: ProjectMeta | null
  scenes: Scene[]
  tags: Tag[]
  boards: Array<
    Omit<Board, 'items'> & {
      items: Array<
        Omit<BoardItem, 'kind'> & {
          kind?: BoardItemKind
          chapter?: string
        }
      >
    }
  >
}

export type ProjectSnapshotV2 = {
  schemaVersion: 2
  exportedAt: string
  project: ProjectMeta | null
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
}

export type ProjectSnapshotV3 = {
  schemaVersion: 3
  exportedAt: string
  project: ProjectMeta | null
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
  notebook: NotebookDocument
}

export type ProjectSnapshot = ProjectSnapshotV1 | ProjectSnapshotV2 | ProjectSnapshotV3

export interface DocuDocApi {
  project: {
    create(path?: string | null): Promise<ProjectMeta | null>
    open(path?: string | null): Promise<ProjectMeta | null>
    saveAs(path?: string | null): Promise<ProjectMeta | null>
    exportJson(path?: string | null): Promise<string | null>
    importJson(path?: string | null): Promise<ProjectMeta | null>
    getMeta(): Promise<ProjectMeta | null>
  }
  notebook: {
    get(): Promise<NotebookDocument>
    update(content: string): Promise<NotebookDocument>
  }
  scenes: {
    list(): Promise<Scene[]>
    create(): Promise<Scene>
    update(input: SceneUpdateInput): Promise<Scene>
    delete(id: string): Promise<void>
  }
  boards: {
    list(): Promise<Board[]>
    createClone(sourceBoardId: string, name?: string): Promise<Board>
    updateBoard(boardId: string, name: string): Promise<Board>
    addScene(boardId: string, sceneId: string, afterItemId?: string | null): Promise<AddSceneToBoardResult>
    addBlock(boardId: string, kind: Exclude<BoardItemKind, 'scene'>, afterItemId?: string | null): Promise<BoardTextItem>
    duplicateItem(itemId: string): Promise<BoardItem>
    removeItem(itemId: string): Promise<void>
    reorder(boardId: string, itemIds: string[]): Promise<BoardItem[]>
    updateItem(input: BoardItemUpdateInput): Promise<BoardItem>
  }
  tags: {
    list(): Promise<Tag[]>
    upsert(input: { id?: string; name: string; type?: TagType }): Promise<Tag>
    delete(id: string): Promise<void>
  }
}
