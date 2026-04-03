import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
  },
}))

import { AIConsultantService } from '../../electron/main/ai-consultant-service'

describe('AIConsultantService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns OpenAI output text for successful requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output_text: 'Stram opp åpningen.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const service = new AIConsultantService(
      {
        getConsultantContext: vi.fn(() => 'Board context'),
      } as never,
      {
        getSettings: () => ({
          ai: {
            provider: 'openai',
            openAiModel: 'gpt-5-mini',
            geminiModel: 'gemini-2.5-flash',
            systemPrompt: 'Be precise',
            extraInstructions: '',
            responseStyle: 'structured',
          },
        }),
        getSecrets: () => ({ openAiApiKey: 'test-key', geminiApiKey: null }),
      } as never,
      100,
    )

    const result = await service.chat({
      activeBoardId: 'board-1',
      context: {
        ambient: 'Workspace: Outline',
        focused: 'Board: Pilot',
      },
      messages: [{ role: 'user', content: 'Hva mangler?' }],
    })

    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-5-mini',
      message: 'Stram opp åpningen.',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('aborts timed-out OpenAI requests with a readable error', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const service = new AIConsultantService(
      {
        getConsultantContext: vi.fn(() => 'Board context'),
      } as never,
      {
        getSettings: () => ({
          ai: {
            provider: 'openai',
            openAiModel: 'gpt-5-mini',
            geminiModel: 'gemini-2.5-flash',
            systemPrompt: 'Be precise',
            extraInstructions: '',
            responseStyle: 'structured',
          },
        }),
        getSecrets: () => ({ openAiApiKey: 'test-key', geminiApiKey: null }),
      } as never,
      25,
    )

    const pending = service.chat({
      activeBoardId: 'board-1',
      context: {
        ambient: 'Workspace: Outline',
        focused: 'Board: Pilot',
      },
      messages: [{ role: 'user', content: 'Hva mangler?' }],
    })
    const assertion = expect(pending).rejects.toThrow('OpenAI request timed out')

    await vi.advanceTimersByTimeAsync(30)

    await assertion
  })
})
