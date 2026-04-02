import { describe, expect, it } from 'vitest'

import type { SceneFolder } from '../../src/types/scene'
import {
  buildFolderPath,
  makeFolderRecord,
  normalizeFolderPath,
  normalizeStoredFolders,
  parseStoredFolders,
  replaceFolderPathPrefix,
} from '../../electron/main/folder-utils'

describe('folder-utils', () => {
  it('normalizes and deduplicates stored folders by path', () => {
    const parsed = parseStoredFolders<SceneFolder>(
      JSON.stringify([
        { path: '  Day 1 / Audio ', color: 'slate', sortOrder: 3 },
        { name: 'Day 1/Audio', color: 'amber', sortOrder: 1 },
        { name: 'Day 1 / Stills', color: 'moss', sortOrder: 2 },
      ]),
    )

    expect(parsed).toEqual([
      {
        path: 'Day 1/Audio',
        name: 'Audio',
        parentPath: 'Day 1',
        color: 'amber',
        sortOrder: 0,
      },
      {
        path: 'Day 1/Stills',
        name: 'Stills',
        parentPath: 'Day 1',
        color: 'moss',
        sortOrder: 1,
      },
    ])
  })

  it('rewrites nested folder prefixes consistently', () => {
    expect(normalizeFolderPath('  Day 1 / Audio /  ')).toBe('Day 1/Audio')
    expect(buildFolderPath('Audio', 'Day 1')).toBe('Day 1/Audio')
    expect(replaceFolderPathPrefix('Day 1/Audio/Interviews', 'Day 1/Audio', 'Day 2/Audio')).toBe(
      'Day 2/Audio/Interviews',
    )

    expect(
      normalizeStoredFolders([
        makeFolderRecord<SceneFolder>('Day 2/Audio', 'slate', 2),
        makeFolderRecord<SceneFolder>('Day 1/Stills', 'amber', 0),
      ]),
    ).toEqual([
      {
        path: 'Day 1/Stills',
        name: 'Stills',
        parentPath: 'Day 1',
        color: 'amber',
        sortOrder: 0,
      },
      {
        path: 'Day 2/Audio',
        name: 'Audio',
        parentPath: 'Day 2',
        color: 'slate',
        sortOrder: 1,
      },
    ])
  })
})
