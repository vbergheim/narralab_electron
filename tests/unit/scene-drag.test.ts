import { describe, expect, it } from 'vitest'

import { readSceneDragData, SCENE_DRAG_ID_MIME, SCENE_DRAG_IDS_MIME, writeSceneDragData } from '@/lib/scene-drag'

class DataTransferMock {
  private readonly data = new Map<string, string>()

  setData(type: string, value: string) {
    this.data.set(type, value)
  }

  getData(type: string) {
    return this.data.get(type) ?? ''
  }
}

describe('scene drag payloads', () => {
  it('writes and reads multi-scene payloads', () => {
    const dataTransfer = new DataTransferMock() as unknown as DataTransfer

    writeSceneDragData(dataTransfer, ['scene-1', '', 'scene-2'])

    expect(readSceneDragData(dataTransfer)).toEqual(['scene-1', 'scene-2'])
    expect((dataTransfer as unknown as DataTransferMock).getData(SCENE_DRAG_ID_MIME)).toBe('scene-1')
    expect((dataTransfer as unknown as DataTransferMock).getData(SCENE_DRAG_IDS_MIME)).toBe('["scene-1","scene-2"]')
  })

  it('falls back to text payloads', () => {
    const dataTransfer = new DataTransferMock() as unknown as DataTransfer
    ;(dataTransfer as unknown as DataTransferMock).setData('text/plain', 'docudoc-scenes:["scene-a","scene-b"]')

    expect(readSceneDragData(dataTransfer)).toEqual(['scene-a', 'scene-b'])
  })

  it('returns an empty list for invalid payloads', () => {
    const dataTransfer = new DataTransferMock() as unknown as DataTransfer
    ;(dataTransfer as unknown as DataTransferMock).setData(SCENE_DRAG_IDS_MIME, '{bad json')

    expect(readSceneDragData(dataTransfer)).toEqual([])
  })
})
