import { describe, expect, it } from 'vitest'

import { parseGlobalUiStatePatch, parseProjectChangeScopes, parseWindowDragSession } from '../../electron/main/ipc-validators'

describe('parseGlobalUiStatePatch', () => {
  it('returns empty patch for empty object', () => {
    expect(parseGlobalUiStatePatch({})).toEqual({})
  })

  it('parses string ids and null', () => {
    expect(
      parseGlobalUiStatePatch({
        activeBoardId: 'b1',
        selectedArchiveFolderId: null,
      }),
    ).toEqual({
      activeBoardId: 'b1',
      selectedArchiveFolderId: null,
    })
  })

  it('rejects non-string id values', () => {
    expect(() => parseGlobalUiStatePatch({ activeBoardId: 1 })).toThrow(/string or null/)
  })
})

describe('parseWindowDragSession', () => {
  it('returns null for null or non-scene', () => {
    expect(parseWindowDragSession(null)).toBe(null)
    expect(parseWindowDragSession({ kind: 'other' })).toBe(null)
  })

  it('returns normalized scene session', () => {
    expect(parseWindowDragSession({ kind: 'scene', sceneIds: ['x', 'y'] })).toEqual({
      kind: 'scene',
      sceneIds: ['x', 'y'],
    })
  })

  it('returns null when no valid scene ids', () => {
    expect(parseWindowDragSession({ kind: 'scene', sceneIds: [] })).toBe(null)
    expect(parseWindowDragSession({ kind: 'scene', sceneIds: ['', '  '] })).toBe(null)
  })
})

describe('parseProjectChangeScopes', () => {
  it('defaults to all when omitted', () => {
    expect(parseProjectChangeScopes(undefined)).toEqual(['all'])
  })

  it('deduplicates scopes while preserving explicit non-all scopes', () => {
    expect(parseProjectChangeScopes(['boards', 'tags', 'boards'])).toEqual(['boards', 'tags'])
    expect(parseProjectChangeScopes(['all', 'layouts'])).toEqual(['all', 'layouts'])
  })

  it('rejects invalid scopes', () => {
    expect(() => parseProjectChangeScopes(['boards', 'nope'])).toThrow(/Project change scope 2/)
  })
})
