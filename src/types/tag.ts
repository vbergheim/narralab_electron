export type TagType = 'general' | 'theme' | 'character' | 'location'

export type Tag = {
  id: string
  name: string
  type: TagType
}
