export type SceneStatus = 'candidate' | 'selected' | 'maybe' | 'omitted' | 'locked'
export type SceneColor =
  | 'charcoal'
  | 'slate'
  | 'amber'
  | 'ochre'
  | 'crimson'
  | 'rose'
  | 'olive'
  | 'moss'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'plum'

export type Scene = {
  id: string
  sortOrder: number
  title: string
  synopsis: string
  notes: string
  color: SceneColor
  status: SceneStatus
  keyRating: number
  folder: string
  category: string
  estimatedDuration: number
  actualDuration: number
  location: string
  characters: string[]
  function: string
  sourceReference: string
  createdAt: string
  updatedAt: string
  tagIds: string[]
}

export type SceneUpdateInput = Partial<Omit<Scene, 'createdAt' | 'updatedAt'>> & Pick<Scene, 'id'>

export type SceneFolder = {
  path: string
  name: string
  parentPath: string | null
  color: SceneColor
  sortOrder: number
}
