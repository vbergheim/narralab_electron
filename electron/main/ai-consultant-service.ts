import type { ConsultantChatInput, ConsultantChatMessage, ConsultantChatResult } from '@/types/ai'

import { AppSettingsService } from './app-settings-service'
import { ProjectService } from './project-service'

export class AIConsultantService {
  private readonly settingsService: AppSettingsService
  private readonly requestTimeoutMs: number

  constructor(_projectService: ProjectService, settingsService: AppSettingsService, requestTimeoutMs = 45_000) {
    this.settingsService = settingsService
    this.requestTimeoutMs = requestTimeoutMs
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

    const systemPrompt = buildConsultantPrompt(
      settings.ai.systemPrompt,
      settings.ai.responseStyle,
      settings.ai.extraInstructions,
      input.context ?? null,
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
    const response = await this.fetchWithTimeout('https://api.openai.com/v1/responses', {
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
    }, 'OpenAI request timed out')

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
    const response = await this.fetchWithTimeout(
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
      'Gemini request timed out',
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

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMessage: string) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs)

    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(timeoutMessage)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

function buildConsultantPrompt(
  systemPrompt: string,
  responseStyle: 'structured' | 'concise' | 'exploratory',
  extraInstructions: string,
  context: ConsultantChatInput['context'] | null,
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
            'Skriv naturlig og menneskelig, ikke som en fast mal.',
            'Ikke start svar rutinemessig med etiketter som "Hovedlesning:", "Konkrete forslag:" eller lignende.',
            'Bruk korte avsnitt eller punkt bare når det faktisk gjør svaret klarere.',
            'Hvis en tydelig struktur hjelper, varier formuleringene og tilpass dem til spørsmålet.',
            'Ikke skriv lange vegger av tekst.',
            'Unngå markdown-formatering som **fet skrift**, backticks og overskrifter med #.',
            'Bruk ren tekst. Hvis du lager punktliste, bruk korte enkle linjer.',
            'Prioriter konkrete anbefalinger over generisk refleksjon.',
            'Hvis brukeren ber om vurdering, start gjerne med en tydelig dom eller reaksjon før du forklarer.',
          ]

  return [
    systemPrompt.trim(),
    'Svar på norsk med mindre brukeren tydelig skriver på et annet språk.',
    'Dette verktøyet brukes primært til dokumentarfilm og dokumentarserier.',
    'Tenk innenfor dokumentariske begrensninger: ikke finn opp nye hendelser, karakterer, vendepunkter eller scener som om dette var fiksjon.',
    'Prioriter alltid først å lese, vurdere og forbedre det materialet og den dekningen som faktisk finnes.',
    'Først når det er nødvendig, kan du foreslå hva som burde hentes inn, filmes på nytt eller bygges med andre dokumentariske grep.',
    'Du kan foreslå hva som bør observeres, filmes på nytt, dekkes med voiceover, bygges med arkiv, intervjuer, inserts, lyd eller rekonstruerte grep, men vær tydelig på forskjellen mellom faktisk materiale og forslag til ny dekning.',
    'Når du foreslår nye scener eller grep, formuler dem som realistiske opptaks- eller konstruksjonsmuligheter, ikke som fri diktning.',
    'Hvis materialet ikke bærer et forslag, si det tydelig og foreslå heller hva som mangler eller hva som må avklares redaksjonelt.',
    ...styleInstructions,
    extraInstructions.trim() ? `Ekstra instruksjoner:\n${extraInstructions.trim()}` : '',
    context?.ambient ? `Ambient context:\n${context.ambient}` : '',
    context?.focused ? `Focused context:\n${context.focused}` : '',
    context?.triggerReason ? `Why the assistant was opened:\n${context.triggerReason}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}
