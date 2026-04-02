import { create } from 'zustand'

import { createArchiveActions } from '@/stores/app-store-archive-actions'
import { createBoardActions } from '@/stores/app-store-board-actions'
import { createConsultantActions } from '@/stores/app-store-consultant-actions'
import { createProjectActions } from '@/stores/app-store-project-actions'
import { createSceneActions } from '@/stores/app-store-scene-actions'
import type { AppStore } from '@/stores/app-store-contract'
import { toMessage } from '@/stores/app-store-utils'
import { emptyNotebookDocument } from '@/lib/notebook-document'

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  busy: false,
  pendingProjectActionCount: 0,
  consultantBusy: false,
  error: null,
  projectMeta: null,
  projectSettings: null,
  appSettings: {
    ai: {
      provider: 'openai',
      openAiModel: 'gpt-5-mini',
      geminiModel: 'gemini-2.5-flash',
      systemPrompt:
        'Du er en skarp, erfaren dokumentarkonsulent. Gi konkrete, redaksjonelle forslag til struktur, dramaturgi, scenevalg, voiceover, tematiske linjer og hva som mangler. Vær presis og arbeidsnær, ikke vag.',
      extraInstructions: '',
      responseStyle: 'structured',
      secretStorageMode: 'safe',
      allowPlaintextSecrets: false,
      hasOpenAiApiKey: false,
      hasGeminiApiKey: false,
    },
    ui: {
      restoreLastProject: true,
      restoreLastLayout: true,
      defaultBoardView: 'outline',
      defaultSceneDensity: 'compact',
      defaultDetachedWorkspace: 'outline',
      lastProjectPath: null,
      lastLayoutByProject: {},
      savedLayouts: [],
    },
    transcription: {
      modelId: 'small',
      language: 'auto',
      timestampInterval: 'segment',
    },
  },
  notebook: emptyNotebookDocument(),
  archiveFolders: [],
  archiveItems: [],
  scenes: [],
  sceneFolders: [],
  boards: [],
  boardFolders: [],
  blockTemplates: [],
  tags: [],
  activeBoardId: null,
  selectedBoardId: null,
  selectedSceneId: null,
  selectedSceneIds: [],
  selectedBoardItemId: null,
  selectedArchiveFolderId: null,
  consultantMessages: [],
  consultantContextMode: 'none',
  workspaceMode: 'outline',
  ...createArchiveActions(set),
  ...createBoardActions(set, get),
  ...createConsultantActions(set, get),
  ...createProjectActions(set, get),
  ...createSceneActions(set, get),

  updateNotebookDraft(notebook) {
    set({ notebook })
  },

  async persistNotebook(notebook) {
    try {
      const next = await window.narralab.notebook.update(notebook)
      set({ notebook: next })
    } catch (error) {
      set({ error: toMessage(error) })
    }
  },

  openBoardInspector(boardId) {
    set({
      activeBoardId: boardId,
      selectedBoardId: boardId,
      selectedSceneId: null,
      selectedSceneIds: [],
      selectedBoardItemId: null,
    })
    void window.narralab.windows.updateGlobalUiState({ activeBoardId: boardId })
  },

  selectScene(sceneId, boardItemId = null) {
    set({
      selectedBoardId: null,
      selectedSceneId: sceneId,
      selectedSceneIds: sceneId ? [sceneId] : [],
      selectedBoardItemId: boardItemId,
    })
  },

  toggleSceneSelection(sceneId) {
    set((state) => {
      const exists = state.selectedSceneIds.includes(sceneId)
      const selectedSceneIds = exists
        ? state.selectedSceneIds.filter((id) => id !== sceneId)
        : [...state.selectedSceneIds, sceneId]

      return {
        selectedBoardId: null,
        selectedSceneIds,
        selectedSceneId: selectedSceneIds[0] ?? null,
        selectedBoardItemId: null,
      }
    })
  },

  setSceneSelection(sceneIds) {
    set({
      selectedBoardId: null,
      selectedSceneIds: sceneIds,
      selectedSceneId: sceneIds[0] ?? null,
      selectedBoardItemId: null,
    })
  },

  clearSceneSelection() {
    set({
      selectedBoardId: null,
      selectedSceneIds: [],
      selectedSceneId: null,
    })
  },

  setWorkspaceMode(workspaceMode) {
    set({ workspaceMode })
  },

  setActiveBoard(activeBoardId) {
    set({ activeBoardId, selectedBoardId: null })
    void window.narralab.windows.updateGlobalUiState({ activeBoardId })
  },

  applyGlobalUiState(input) {
    set((state) => ({
      activeBoardId: input.activeBoardId ?? state.activeBoardId,
      selectedArchiveFolderId: input.selectedArchiveFolderId ?? state.selectedArchiveFolderId,
    }))
  },

  dismissError() {
    set({ error: null })
  },
}))
