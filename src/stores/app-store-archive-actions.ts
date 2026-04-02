import type { AppStore, AppStoreSet } from '@/stores/app-store-contract'
import { runProjectAction, toMessage } from '@/stores/app-store-utils'

export function createArchiveActions(
  set: AppStoreSet,
): Pick<
  AppStore,
  | 'createArchiveFolder'
  | 'renameArchiveFolder'
  | 'updateArchiveFolder'
  | 'deleteArchiveFolder'
  | 'addArchiveFiles'
  | 'moveArchiveItem'
  | 'deleteArchiveItem'
  | 'openArchiveItem'
  | 'revealArchiveItem'
  | 'setSelectedArchiveFolder'
> {
  return {
    async createArchiveFolder(name, parentId = null) {
      await runProjectAction(set, async () => {
        const archiveFolders = await window.narralab.archive.folders.create(name, parentId)
        set({ archiveFolders })
      })
    },

    async renameArchiveFolder(folderId, name) {
      await runProjectAction(set, async () => {
        const archiveFolders = await window.narralab.archive.folders.rename(folderId, name)
        set({ archiveFolders })
      })
    },

    async updateArchiveFolder(folderId, input) {
      await runProjectAction(set, async () => {
        const archiveFolders = await window.narralab.archive.folders.update({ id: folderId, ...input })
        set({ archiveFolders })
      })
    },

    async deleteArchiveFolder(folderId) {
      await runProjectAction(set, async () => {
        const archiveFolders = await window.narralab.archive.folders.delete(folderId)
        const archiveItems = await window.narralab.archive.items.list()
        set((state) => ({
          archiveFolders,
          archiveItems,
          selectedArchiveFolderId: state.selectedArchiveFolderId === folderId ? null : state.selectedArchiveFolderId,
        }))
      })
    },

    async addArchiveFiles(filePaths, folderId = null) {
      await runProjectAction(set, async () => {
        const added = await window.narralab.archive.items.add(filePaths, folderId)
        if (added.length === 0) return
        const archiveItems = await window.narralab.archive.items.list()
        set((state) => ({
          archiveItems,
          selectedArchiveFolderId: folderId ?? state.selectedArchiveFolderId,
        }))
      })
    },

    async moveArchiveItem(itemId, folderId) {
      await runProjectAction(set, async () => {
        await window.narralab.archive.items.update({ id: itemId, folderId })
        const archiveItems = await window.narralab.archive.items.list()
        set({ archiveItems })
      })
    },

    async deleteArchiveItem(itemId) {
      await runProjectAction(set, async () => {
        await window.narralab.archive.items.delete(itemId)
        set((state) => ({
          archiveItems: state.archiveItems.filter((item) => item.id !== itemId),
        }))
      })
    },

    async openArchiveItem(itemId) {
      try {
        await window.narralab.archive.items.open(itemId)
      } catch (error) {
        set({ error: toMessage(error) })
      }
    },

    async revealArchiveItem(itemId) {
      try {
        await window.narralab.archive.items.reveal(itemId)
      } catch (error) {
        set({ error: toMessage(error) })
      }
    },

    setSelectedArchiveFolder(folderId) {
      set({ selectedArchiveFolderId: folderId })
      void window.narralab.windows.updateGlobalUiState({ selectedArchiveFolderId: folderId })
    },
  }
}
