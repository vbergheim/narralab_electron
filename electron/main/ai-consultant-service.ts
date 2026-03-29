import type { ConsultantChatInput, ConsultantChatMessage, ConsultantChatResult } from '@/types/ai'

import { AppSettingsService } from './app-settings-service'
import { ProjectService } from './project-service'

export class AIConsultantService {
  private projectService: ProjectService
  private settingsService: AppSettingsService

  constructor(projectService: ProjectService, settingsService: AppSettingsService) {
    this.projectService = projectService
    this.settingsService = settingsService
  }

  async chat(input: ConsultantChatInput): Promise<ConsultantChatResult> {
    const settings = this.settingsService.getSettings()
    const secrets = this.settingsService.getSecrets()
    const provider = settings.ai.provider
    const model = provider === 'openai' ? settings.ai.openAiModel : settings.ai.geminiModel
    const apiKey = provider === 'openai' ? secrets.openAiApiKey : secrets.geminiApiKey

    if (!apiKey) {
      throw new Error(`No ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API key configured in Settings`)
    }

    const context =
      input.contextMode === 'active-board'
        ? this.projectService.getConsultantContext(input.activeBoardId ?? null)
        : null

    const systemPrompt = buildConsultantPrompt(
      settings.ai.systemPrompt,
      settings.ai.responseStyle,
      settings.ai.extraInstructions,
      context,
    )

    const message =
      provider === 'openai'
        ? await this.chatWithOpenAI(apiKey, model, systemPrompt, input.messages)
        : await this.chatWithGemini(apiKey, model, systemPrompt, input.messages)

    return { provider, model, message }
  }

  private async chatWithOpenAI(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConsultantChatMessage[],
  ) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: messages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role,
            content: [{ type: 'input_text', text: message.content }],
          })),
      }),
    })

    const data = (await response.json()) as {
      error?: { message?: string }
      output_text?: string
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
    }

    if (!response.ok) {
      throw new Error(data.error?.message ?? 'OpenAI request failed')
    }

    const text =
      data.output_text?.trim() ||
      data.output
        ?.flatMap((entry) => entry.content ?? [])
        .map((entry) => entry.text ?? '')
        .join('\n')
        .trim()

    if (!text) {
      throw new Error('OpenAI returned an empty response')
    }

    return text
  }

  private async chatWithGemini(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConsultantChatMessage[],
  ) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
        }),
      },
    )

    const data = (await response.json()) as {
      error?: { message?: string }
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    if (!response.ok) {
      throw new Error(data.error?.message ?? 'Gemini request failed')
    }

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim()
    if (!text) {
      throw new Error('Gemini returned an empty response')
    }

    return text
  }
}

function buildConsultantPrompt(
  systemPrompt: string,
  responseStyle: 'structured' | 'concise' | 'exploratory',
  extraInstructions: string,
  context: string | null,
) {
  const styleInstructions =
    responseStyle === 'concise'
      ? [
          'Svar kort og direkte.',
          'Gi maks 3 konkrete forslag.',
          'Unngå lange resonnementer med mindre brukeren ber om det.',
        ]
      : responseStyle === 'exploratory'
        ? [
            'Tenk mer utforskende og ideskapende.',
            'Vis gjerne 2-3 alternative lesninger av materialet.',
            'Hold likevel svaret ryddig og brukbart.',
          ]
        : [
            'Svar ryddig og stramt.',
            'Bruk denne standardstrukturen som hovedregel: 1. Hovedlesning 2. Konkrete forslag 3. Risikoer eller åpne spørsmål.',
            'Hver del skal være kort. Foretrekk 1-3 punkt per del.',
            'Ikke skriv lange vegger av tekst.',
            'Unngå markdown-formatering som **fet skrift**, backticks og overskrifter med #.',
            'Bruk ren tekst. Hvis du lager punktliste, bruk korte enkle linjer.',
            'Prioriter konkrete anbefalinger over generisk refleksjon.',
            'Hvis brukeren ber om vurdering, start med en tydelig dom før du forklarer.',
          ]

  return [
    systemPrompt.trim(),
    'Svar på norsk med mindre brukeren tydelig skriver på et annet språk.',
    ...styleInstructions,
    extraInstructions.trim() ? `Ekstra instruksjoner:\n${extraInstructions.trim()}` : '',
    context ? `Project context:\n${context}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}
