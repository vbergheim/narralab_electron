import type { SceneColor } from './scene'

export type ArchiveFolder = {
  id: string
  name: string
  parentId: string | null
  color: SceneColor
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ArchiveFolderUpdateInput = {
  id: string
  name?: string
  parentId?: string | null
  color?: SceneColor
}

export type ArchiveItemKind = 'document' | 'image' | 'audio' | 'video' | 'pdf' | 'spreadsheet' | 'link' | 'other'

export type ArchiveItem = {
  id: string
  folderId: string | null
  name: string
  filePath: string
  kind: ArchiveItemKind
  extension: string
  exists: boolean
  fileSize: number
  createdAt: string
  updatedAt: string
}

export type ArchiveItemUpdateInput = {
  id: string
  folderId?: string | null
  name?: string
}
