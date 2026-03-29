import type { ArchiveFolder, ArchiveFolderUpdateInput, ArchiveItem, ArchiveItemUpdateInput } from './archive'
import type {
  AppSettings,
  AppSettingsUpdateInput,
  ConsultantChatInput,
  ConsultantChatResult,
} from './ai'
import type {
  AddSceneToBoardResult,
  Board,
  BoardFolder,
  BoardItem,
  BoardItemKind,
  BlockTemplate,
  BoardUpdateInput,
  BoardItemUpdateInput,
  BoardTextItem,
} from './board'
import type { Scene, SceneFolder, SceneUpdateInput } from './scene'
import type { Tag, TagType } from './tag'

export type ProjectMeta = {
  path: string
  name: string
}

export type NotebookDocument = {
  content: string
  updatedAt: string | null
}

export type BoardScriptExportFormat = 'txt-formatted' | 'txt-plain' | 'md' | 'html-screenplay' | 'doc-screenplay'

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

export type ProjectSnapshotV4 = {
  schemaVersion: 4
  exportedAt: string
  project: ProjectMeta | null
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
  notebook: NotebookDocument
}

export type ProjectSnapshot = ProjectSnapshotV1 | ProjectSnapshotV2 | ProjectSnapshotV3 | ProjectSnapshotV4

export interface DocuDocApi {
  project: {
    create(path?: string | null): Promise<ProjectMeta | null>
    open(path?: string | null): Promise<ProjectMeta | null>
    saveAs(path?: string | null): Promise<ProjectMeta | null>
    exportJson(path?: string | null): Promise<string | null>
    exportBoardScript(boardId: string, path?: string | null, format?: BoardScriptExportFormat): Promise<string | null>
    importJson(path?: string | null): Promise<ProjectMeta | null>
    getMeta(): Promise<ProjectMeta | null>
  }
  notebook: {
    get(): Promise<NotebookDocument>
    update(content: string): Promise<NotebookDocument>
  }
  archive: {
    folders: {
      list(): Promise<ArchiveFolder[]>
      create(name: string, parentId?: string | null): Promise<ArchiveFolder[]>
      rename(folderId: string, name: string): Promise<ArchiveFolder[]>
      update(input: ArchiveFolderUpdateInput): Promise<ArchiveFolder[]>
      delete(folderId: string): Promise<ArchiveFolder[]>
    }
    items: {
      list(): Promise<ArchiveItem[]>
      add(filePaths?: string[] | null, folderId?: string | null): Promise<ArchiveItem[]>
      update(input: ArchiveItemUpdateInput): Promise<ArchiveItem>
      delete(itemId: string): Promise<void>
      open(itemId: string): Promise<void>
      reveal(itemId: string): Promise<void>
    }
  }
  scenes: {
    list(): Promise<Scene[]>
    create(): Promise<Scene>
    update(input: SceneUpdateInput): Promise<Scene>
    delete(id: string): Promise<void>
    reorder(sceneIds: string[]): Promise<Scene[]>
  }
  sceneFolders: {
    list(): Promise<SceneFolder[]>
    create(name: string, parentPath?: string | null): Promise<SceneFolder[]>
    update(currentPath: string, input: { name?: string; color?: Scene['color']; parentPath?: string | null }): Promise<SceneFolder[]>
    delete(currentPath: string): Promise<SceneFolder[]>
  }
  boards: {
    list(): Promise<Board[]>
    create(name: string, folder?: string | null): Promise<Board>
    createClone(sourceBoardId: string, name?: string): Promise<Board>
    delete(boardId: string): Promise<Board[]>
    updateBoard(input: BoardUpdateInput): Promise<Board>
    reorderBoards(boardIds: string[]): Promise<Board[]>
    addScene(boardId: string, sceneId: string, afterItemId?: string | null): Promise<AddSceneToBoardResult>
    addBlock(boardId: string, kind: Exclude<BoardItemKind, 'scene'>, afterItemId?: string | null): Promise<BoardTextItem>
    duplicateItem(itemId: string): Promise<BoardItem>
    removeItem(itemId: string): Promise<void>
    reorder(boardId: string, itemIds: string[]): Promise<BoardItem[]>
    updateItem(input: BoardItemUpdateInput): Promise<BoardItem>
  }
  boardFolders: {
    list(): Promise<BoardFolder[]>
    create(name: string, parentPath?: string | null): Promise<BoardFolder[]>
    rename(oldPath: string, newName: string): Promise<BoardFolder[]>
    update(currentPath: string, input: { name?: string; color?: Scene['color']; parentPath?: string | null }): Promise<BoardFolder[]>
    delete(currentPath: string): Promise<BoardFolder[]>
  }
  blockTemplates: {
    list(): Promise<BlockTemplate[]>
    create(input: { kind: Exclude<BoardItemKind, 'scene'>; name: string; title: string; body: string }): Promise<BlockTemplate[]>
    delete(id: string): Promise<BlockTemplate[]>
  }
  settings: {
    get(): Promise<AppSettings>
    update(input: AppSettingsUpdateInput): Promise<AppSettings>
  }
  consultant: {
    chat(input: ConsultantChatInput): Promise<ConsultantChatResult>
  }
  tags: {
    list(): Promise<Tag[]>
    upsert(input: { id?: string; name: string; type?: TagType }): Promise<Tag>
    delete(id: string): Promise<void>
  }
}
