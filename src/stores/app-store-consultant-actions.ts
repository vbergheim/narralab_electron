import { buildConsultantContext, inferConsultantHint } from '@/features/consultant/consultant-context'
import type { AppStore, AppStoreGet, AppStoreSet } from '@/stores/app-store-contract'
import { toMessage } from '@/stores/app-store-utils'
import type { ConsultantMessage } from '@/types/ai'

export function createConsultantActions(
  set: AppStoreSet,
  get: AppStoreGet,
): Pick<AppStore, 'sendConsultantMessage' | 'clearConsultantConversation'> {
  return {
    async sendConsultantMessage(content) {
      const message = content.trim()
      if (!message) return

      const optimisticUserMessage: ConsultantMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      }

      set((state) => ({
        consultantBusy: true,
        consultantMessages: [...state.consultantMessages, optimisticUserMessage],
      }))

      try {
        const state = get()
        const conversation = [...state.consultantMessages].slice(-8)
        const contextInput = {
          projectMeta: state.projectMeta,
          projectSettings: state.projectSettings,
          workspaceMode: state.workspaceMode,
          boards: state.boards,
          scenes: state.scenes,
          tags: state.tags,
          activeBoardId: state.activeBoardId,
          selectedSceneId: state.selectedSceneId,
          selectedSceneIds: state.selectedSceneIds,
          selectedBoardItemId: state.selectedBoardItemId,
        }
        const hint = inferConsultantHint(contextInput)
        const result = await window.narralab.consultant.chat({
          activeBoardId: state.activeBoardId,
          context: {
            ...buildConsultantContext(contextInput),
            triggerReason: conversation.length === 1 ? hint?.reason ?? null : null,
          },
          messages: conversation.map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
        })

        const reply: ConsultantMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.message,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          consultantBusy: false,
          consultantMessages: [...state.consultantMessages, reply],
        }))
      } catch (error) {
        const reply: ConsultantMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: toMessage(error),
          createdAt: new Date().toISOString(),
          error: true,
        }

        set((state) => ({
          consultantBusy: false,
          error: toMessage(error),
          consultantMessages: [...state.consultantMessages, reply],
        }))
      }
    },

    clearConsultantConversation() {
      set({ consultantMessages: [] })
    },
  }
}
