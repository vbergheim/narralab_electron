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

export type SceneBeat = {
  id: string
  sceneId: string
  sortOrder: number
  text: string
  createdAt: string
  updatedAt: string
}

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
  quoteMoment: string
  quality: string
  sourcePaths: string[]
  createdAt: string
  updatedAt: string
  tagIds: string[]
  beats: SceneBeat[]
}

export type SceneUpdateInput = Partial<Omit<Scene, 'createdAt' | 'updatedAt' | 'beats'>> & Pick<Scene, 'id'>

export type SceneBeatUpdateInput = Partial<Omit<SceneBeat, 'createdAt' | 'updatedAt' | 'sceneId'>> &
  Pick<SceneBeat, 'id'>

export type SceneFolder = {
  path: string
  name: string
  parentPath: string | null
  color: SceneColor
  sortOrder: number
}
