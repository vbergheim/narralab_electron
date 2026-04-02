import {
  buildStateFromFullSnapshot,
  loadFullProjectSnapshot,
  loadProjectChangeData,
  mergeProjectChangeResult,
  normalizeProjectChangeScopes,
  resetProjectState,
} from '@/stores/project-sync'
import type { AppStore, AppStoreGet, AppStoreSet } from '@/stores/app-store-contract'
import { formatShootLogImportErrors, runProjectAction, toMessage } from '@/stores/app-store-utils'

export function createProjectActions(
  set: AppStoreSet,
  get: AppStoreGet,
): Pick<
  AppStore,
  | 'initialize'
  | 'refreshAll'
  | 'syncProjectChanges'
  | 'createProject'
  | 'openProject'
  | 'saveProjectAs'
  | 'importJson'
  | 'importShootLog'
  | 'updateAppSettings'
  | 'updateProjectSettings'
  | 'exportJson'
  | 'exportActiveBoardScript'
> {
  return {
    async initialize() {
      try {
        const [meta, appSettings, globalUiState] = await Promise.all([
          window.narralab.project.getMeta(),
          window.narralab.settings.get(),
          window.narralab.windows.getGlobalUiState(),
        ])
        set({ ready: true, projectMeta: meta, appSettings })
        get().applyGlobalUiState(globalUiState)
        if (meta) {
          await get().refreshAll()
        }
      } catch (error) {
        set({ ready: true, error: toMessage(error) })
      }
    },

    async refreshAll() {
      const snapshot = await loadFullProjectSnapshot(window.narralab)
      if (!snapshot) {
        set(resetProjectState())
        return
      }

      set((state) => buildStateFromFullSnapshot(state, snapshot))
    },

    async syncProjectChanges(scopes) {
      try {
        const normalizedScopes = normalizeProjectChangeScopes(scopes)
        const result = await loadProjectChangeData(window.narralab, get().projectMeta, normalizedScopes)

        if (result.kind === 'reset') {
          set(resetProjectState())
          return
        }

        if (result.kind === 'full') {
          const snapshot = result.snapshot
          if (!snapshot) {
            set(resetProjectState())
            return
          }

          set((state) => buildStateFromFullSnapshot(state, snapshot))
          return
        }

        set((state) => mergeProjectChangeResult(state, result))
      } catch (error) {
        set({ error: toMessage(error) })
      }
    },

    async createProject() {
      await runProjectAction(set, async () => {
        const meta = await window.narralab.project.create()
        if (meta) {
          await get().refreshAll()
          set({ consultantMessages: [] })
        }
      })
    },

    async openProject() {
      await runProjectAction(set, async () => {
        const meta = await window.narralab.project.open()
        if (meta) {
          await get().refreshAll()
          set({ consultantMessages: [] })
        }
      })
    },

    async saveProjectAs() {
      await runProjectAction(set, async () => {
        const meta = await window.narralab.project.saveAs()
        if (meta) await get().refreshAll()
      })
    },

    async importJson() {
      await runProjectAction(set, async () => {
        const meta = await window.narralab.project.importJson()
        if (meta) {
          await get().refreshAll()
          set({ consultantMessages: [] })
        }
      })
    },

    async importShootLog() {
      await runProjectAction(set, async () => {
        const result = await window.narralab.project.importShootLog()
        if (!result) return

        if (result.errors.length > 0) {
          throw new Error(formatShootLogImportErrors(result))
        }

        if (result.addedSceneCount > 0 || result.addedBeatCount > 0) {
          await get().refreshAll()
        }
      })
    },

    async updateAppSettings(input) {
      await runProjectAction(set, async () => {
        const appSettings = await window.narralab.settings.update(input)
        set({ appSettings })
      })
    },

    async updateProjectSettings(input) {
      await runProjectAction(set, async () => {
        const projectSettings = await window.narralab.project.updateSettings(input)
        set({ projectSettings })
      })
    },

    async exportJson() {
      await runProjectAction(set, async () => {
        await window.narralab.project.exportJson()
      })
    },

    async exportActiveBoardScript(format) {
      await runProjectAction(set, async () => {
        const activeBoardId = get().activeBoardId
        if (!activeBoardId) {
          throw new Error('Select a board before exporting a script')
        }
        await window.narralab.project.exportBoardScript(activeBoardId, null, format)
      })
    },
  }
}
