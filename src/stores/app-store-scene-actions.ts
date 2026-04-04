import type { AppStore, AppStoreGet, AppStoreSet } from '@/stores/app-store-contract'
import { inferTagType, runProjectAction, sortBeats } from '@/stores/app-store-utils'
import type { SceneUpdateInput } from '@/types/scene'

export function createSceneActions(
  set: AppStoreSet,
  get: AppStoreGet,
): Pick<
  AppStore,
  | 'createScene'
  | 'createSceneBeat'
  | 'updateSceneBeat'
  | 'deleteSceneBeat'
  | 'reorderSceneBeats'
  | 'createSceneFolder'
  | 'updateSceneFolder'
  | 'deleteSceneFolder'
  | 'moveScenesToFolder'
  | 'reorderScenes'
  | 'deleteScene'
  | 'deleteScenes'
  | 'persistSceneDraft'
  | 'bulkUpdateScenes'
  | 'duplicateScene'
> {
  return {
    async createScene() {
      await runProjectAction(set, async () => {
        const scene = await window.narralab.scenes.create()
        set({
          scenes: [scene, ...get().scenes],
          selectedSceneId: scene.id,
          selectedSceneIds: [scene.id],
          selectedBoardItemId: null,
        })
      })
    },

    async createSceneBeat(sceneId, afterBeatId = null) {
      await runProjectAction(set, async () => {
        const beat = await window.narralab.sceneBeats.create(sceneId, afterBeatId)
        set((state) => ({
          scenes: state.scenes.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  beats: sortBeats([...(scene.beats ?? []), beat]),
                }
              : scene,
          ),
        }))
      })
    },

    async updateSceneBeat(input) {
      await runProjectAction(set, async () => {
        const beat = await window.narralab.sceneBeats.update(input)
        set((state) => ({
          scenes: state.scenes.map((scene) =>
            scene.id === beat.sceneId
              ? {
                  ...scene,
                  beats: sortBeats((scene.beats ?? []).map((entry) => (entry.id === beat.id ? beat : entry))),
                }
              : scene,
          ),
        }))
      })
    },

    async deleteSceneBeat(id) {
      await runProjectAction(set, async () => {
        await window.narralab.sceneBeats.delete(id)
        set((state) => ({
          scenes: state.scenes.map((scene) => ({
            ...scene,
            beats: (scene.beats ?? []).filter((beat) => beat.id !== id),
          })),
        }))
      })
    },

    async reorderSceneBeats(sceneId, beatIds) {
      await runProjectAction(set, async () => {
        const beats = await window.narralab.sceneBeats.reorder(sceneId, beatIds)
        set((state) => ({
          scenes: state.scenes.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  beats,
                }
              : scene,
          ),
        }))
      })
    },

    async createSceneFolder(name, parentPath = null) {
      await runProjectAction(set, async () => {
        const sceneFolders = await window.narralab.sceneFolders.create(name, parentPath)
        set({ sceneFolders })
      })
    },

    async updateSceneFolder(currentPath, input) {
      await runProjectAction(set, async () => {
        const sceneFolders = await window.narralab.sceneFolders.update(currentPath, input)
        const scenes =
          input.name !== undefined || input.parentPath !== undefined
            ? await window.narralab.scenes.list()
            : get().scenes
        set({ sceneFolders, scenes })
      })
    },

    async deleteSceneFolder(currentPath) {
      await runProjectAction(set, async () => {
        const [sceneFolders, scenes] = await Promise.all([
          window.narralab.sceneFolders.delete(currentPath),
          window.narralab.scenes.list(),
        ])
        set({ sceneFolders, scenes })
      })
    },

    async moveScenesToFolder(sceneIds, folder) {
      await runProjectAction(set, async () => {
        const uniqueSceneIds = [...new Set(sceneIds.filter(Boolean))]
        if (uniqueSceneIds.length === 0) return

        const updatedScenes = await Promise.all(
          uniqueSceneIds.map((sceneId) =>
            window.narralab.scenes.update({ id: sceneId, folder } satisfies SceneUpdateInput),
          ),
        )
        const updatesById = new Map(updatedScenes.map((scene) => [scene.id, scene]))
        set((state) => ({
          scenes: state.scenes.map((scene) => updatesById.get(scene.id) ?? scene),
        }))
      })
    },

    async reorderScenes(sceneIds) {
      await runProjectAction(set, async () => {
        const scenes = await window.narralab.scenes.reorder(sceneIds)
        set({ scenes })
      })
    },

    async deleteScene(sceneId) {
      await runProjectAction(set, async () => {
        await window.narralab.scenes.delete(sceneId)
        set((state) => ({
          scenes: state.scenes.filter((scene) => scene.id !== sceneId),
          boards: state.boards.map((board) => ({
            ...board,
            items: board.items.filter((item) => !(item.kind === 'scene' && item.sceneId === sceneId)),
          })),
          selectedSceneIds: state.selectedSceneIds.filter((id) => id !== sceneId),
          selectedSceneId: state.selectedSceneId === sceneId ? null : state.selectedSceneId,
          selectedBoardItemId: state.selectedSceneId === sceneId ? null : state.selectedBoardItemId,
        }))
      })
    },

    async deleteScenes(sceneIds) {
      await runProjectAction(set, async () => {
        const uniqueSceneIds = [...new Set(sceneIds.filter(Boolean))]
        if (uniqueSceneIds.length === 0) return

        await Promise.all(uniqueSceneIds.map((sceneId) => window.narralab.scenes.delete(sceneId)))
        const deletedSceneIdSet = new Set(uniqueSceneIds)

        set((state) => ({
          scenes: state.scenes.filter((scene) => !deletedSceneIdSet.has(scene.id)),
          boards: state.boards.map((board) => ({
            ...board,
            items: board.items.filter((item) => !(item.kind === 'scene' && deletedSceneIdSet.has(item.sceneId))),
          })),
          selectedSceneIds: state.selectedSceneIds.filter((id) => !deletedSceneIdSet.has(id)),
          selectedSceneId:
            state.selectedSceneId && deletedSceneIdSet.has(state.selectedSceneId) ? null : state.selectedSceneId,
          selectedBoardItemId:
            state.selectedBoardItemId &&
            state.boards.some((board) =>
              board.items.some(
                (item) =>
                  item.id === state.selectedBoardItemId &&
                  item.kind === 'scene' &&
                  deletedSceneIdSet.has(item.sceneId),
              ),
            )
              ? null
              : state.selectedBoardItemId,
        }))
      })
    },

    async persistSceneDraft(input) {
      await runProjectAction(set, async () => {
        const tags = get().tags
        const tagIds: string[] = []

        for (const rawName of input.tagNames) {
          const name = rawName.trim()
          if (!name) continue
          const existing = tags.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
          const tag = existing ?? (await window.narralab.tags.upsert({ name, type: inferTagType(name) }))
          if (!existing) {
            set((state) => ({ tags: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }))
          }
          tagIds.push(tag.id)
        }

        const updated = await window.narralab.scenes.update({
          id: input.id,
          title: input.title,
          synopsis: input.synopsis,
          shootDate: input.shootDate,
          shootBlock: input.shootBlock,
          notes: input.notes,
          cameraNotes: input.cameraNotes,
          audioNotes: input.audioNotes,
          color: input.color,
          status: input.status,
          folder: input.folder,
          keyRating: input.keyRating,
          category: input.category,
          estimatedDuration: input.estimatedDuration,
          actualDuration: input.actualDuration,
          location: input.location,
          characters: input.characters,
          function: input.function,
          sourceReference: input.sourceReference,
          quoteMoment: input.quoteMoment,
          quality: input.quality,
          sourcePaths: input.sourcePaths,
          tagIds,
        } satisfies SceneUpdateInput)

        set((state) => ({
          scenes: state.scenes.map((scene) => (scene.id === updated.id ? updated : scene)),
        }))
      })
    },

    async bulkUpdateScenes(input) {
      await runProjectAction(set, async () => {
        const currentScenes = get().scenes.filter((scene) => input.sceneIds.includes(scene.id))

        const updates = await Promise.all(
          currentScenes.map((scene) =>
            window.narralab.scenes.update({
              id: scene.id,
              category: input.category ?? scene.category,
              status: input.status ?? scene.status,
              color: input.color ?? scene.color,
            } satisfies SceneUpdateInput),
          ),
        )

        set((state) => ({
          scenes: state.scenes.map((scene) => updates.find((entry) => entry.id === scene.id) ?? scene),
        }))
      })
    },

    async duplicateScene(sceneId, options) {
      const source = get().scenes.find((scene) => scene.id === sceneId)
      if (!source) return

      await runProjectAction(set, async () => {
        const created = await window.narralab.scenes.create()
        const duplicated = await window.narralab.scenes.update({
          id: created.id,
          title: source.title ? `${source.title} Copy` : 'Untitled Scene Copy',
          synopsis: source.synopsis,
          shootDate: source.shootDate,
          shootBlock: source.shootBlock,
          shootDayPlace: source.shootDayPlace,
          shootDayProduction: source.shootDayProduction,
          shootDayDirector: source.shootDayDirector,
          shootDayPhotographer: source.shootDayPhotographer,
          shootDayParticipants: source.shootDayParticipants,
          shootDayFolderName: source.shootDayFolderName,
          shootDayFileName: source.shootDayFileName,
          shootDayClipCount: source.shootDayClipCount,
          shootDayDescription: source.shootDayDescription,
          shootDayStrongestMaterial: source.shootDayStrongestMaterial,
          shootDayFollowUp: source.shootDayFollowUp,
          notes: source.notes,
          cameraNotes: source.cameraNotes,
          audioNotes: source.audioNotes,
          color: source.color,
          status: source.status,
          folder: source.folder,
          keyRating: source.keyRating,
          category: source.category,
          estimatedDuration: source.estimatedDuration,
          actualDuration: source.actualDuration,
          location: source.location,
          characters: source.characters,
          function: source.function,
          sourceReference: source.sourceReference,
          quoteMoment: source.quoteMoment,
          quality: source.quality,
          sourcePaths: source.sourcePaths,
          tagIds: source.tagIds,
        } satisfies SceneUpdateInput)

        let duplicatedWithBeats = duplicated
        for (const sourceBeat of source.beats) {
          const createdBeat = await window.narralab.sceneBeats.create(
            duplicated.id,
            duplicatedWithBeats.beats.at(-1)?.id ?? null,
          )
          const updatedBeat = await window.narralab.sceneBeats.update({
            id: createdBeat.id,
            text: sourceBeat.text,
          })
          duplicatedWithBeats = {
            ...duplicatedWithBeats,
            beats: [...duplicatedWithBeats.beats, updatedBeat],
          }
        }

        set((state) => ({
          scenes: [duplicatedWithBeats, ...state.scenes],
          selectedBoardId: null,
          selectedSceneId: duplicatedWithBeats.id,
          selectedSceneIds: [duplicatedWithBeats.id],
          selectedBoardItemId: null,
        }))

        if (options?.addToBoardAfterItemId !== undefined) {
          await get().addSceneToActiveBoard(duplicatedWithBeats.id, options.addToBoardAfterItemId ?? null)
        }
      })
    },
  }
}
