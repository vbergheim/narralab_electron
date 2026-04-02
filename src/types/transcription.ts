import type { SceneFolder } from './scene'

export type TranscriptionModelId = 'base' | 'small' | 'medium' | 'large-v3-turbo' | 'nb-whisper-medium' | 'nb-whisper-large'

export type TranscriptionLanguage =
  | 'auto'
  | 'en'
  | 'nb'
  | 'nn'
  | 'sv'
  | 'da'
  | 'de'
  | 'fr'
  | 'es'
  | 'it'
  | 'pt'
  | 'nl'
  | 'pl'
  | 'ru'
  | 'uk'
  | 'ja'
  | 'zh'

/**
 * How often to insert a [HH:MM:SS] timestamp marker in the transcript text.
 * 'none'    – plain text, no timestamps
 * 'segment' – every whisper segment (~sentence)
 * number    – interval in seconds (e.g. 60 for 1 minute)
 */
export type TranscriptionTimestampInterval = 'none' | 'segment' | number

export type TranscriptionModelCatalogEntry = {
  id: TranscriptionModelId
  /** File name under userData/whisper/models/ */
  fileName: string
  /** Direct download URL (Hugging Face resolve). */
  url: string
  label: string
  /** Approximate size for UI hints (MiB). */
  sizeMiB: number
  description: string
}

export const TRANSCRIPTION_MODEL_CATALOG: TranscriptionModelCatalogEntry[] = [
  {
    id: 'base',
    fileName: 'ggml-base.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    label: 'Base',
    sizeMiB: 148,
    description: 'Fastest; lower accuracy.',
  },
  {
    id: 'small',
    fileName: 'ggml-small.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    label: 'Small (balanced)',
    sizeMiB: 488,
    description: 'Good default for interviews on CPU.',
  },
  {
    id: 'medium',
    fileName: 'ggml-medium.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    label: 'Medium',
    sizeMiB: 1_538,
    description: 'Higher quality; slower and more RAM.',
  },
  {
    id: 'large-v3-turbo',
    fileName: 'ggml-large-v3-turbo.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
    label: 'Large v3 turbo',
    sizeMiB: 1_620,
    description: 'Closest to a “turbo” profile: strong quality, optimized large model.',
  },
  {
    id: 'nb-whisper-medium',
    fileName: 'ggml-nb-whisper-medium-q5_0.bin',
    url: 'https://huggingface.co/NbAiLab/nb-whisper-medium/resolve/main/ggml-model-q5_0.bin',
    label: 'NB-Whisper Medium (Norsk)',
    sizeMiB: 515,
    description: 'Skreddersydd for rask og nøyaktig norsk tale (bokmål og nynorsk).',
  },
  {
    id: 'nb-whisper-large',
    fileName: 'ggml-nb-whisper-large-q5_0.bin',
    url: 'https://huggingface.co/NbAiLab/nb-whisper-large/resolve/main/ggml-model-q5_0.bin',
    label: 'NB-Whisper Large (Norsk)',
    sizeMiB: 1035,
    description: 'Markedsledende for norsk tale. Høyest nøyaktighet – krever mer minne.',
  },
]

export type TranscriptionPhase = 'idle' | 'preparing' | 'transcribing' | 'complete' | 'error' | 'cancelled'

export type TranscriptionStatus = {
  phase: TranscriptionPhase
  message: string
  progressLine?: string
  /** 0–1 when known */
  progress?: number
  resultText?: string
  error?: string
}

export type TranscriptionEngineDownloadPart = 'windows-zip' | 'whisper-cpp' | 'ggml' | 'libomp'

export type TranscriptionProgressEvent =
  | { type: 'status'; payload: TranscriptionStatus }
  | { type: 'download'; payload: { modelId: TranscriptionModelId; bytesReceived: number; totalBytes: number | null } }
  | {
      type: 'engine-download'
      payload: { part: TranscriptionEngineDownloadPart; bytesReceived: number; totalBytes: number | null }
    }
  | { type: 'ffmpeg-download'; payload: { bytesReceived: number; totalBytes: number | null } }

/** Rå teknisk tilstand fra main process (feilsøking / lim inn i støtte). */
export type TranscriptionMainDiagnostics = {
  appVersion: string
  platform: string
  /** Node/Electron main process arch (f.eks. x64 vs arm64). */
  mainArch: string
  /** Oppløst sti til whisper-cli (kan være null). */
  whisperCliPath: string | null
  /** Utdata fra `/usr/bin file` på binæren (arkitektur m.m.). */
  whisperBinaryFileDescription: string
  /** Rask test: `whisper-cli -h` med samme miljø som transkripsjon (avslører om binæren i det hele tatt starter). */
  whisperHelpProbe: string
  status: TranscriptionStatus
  cancelled: boolean
  ffmpegChildRunning: boolean
  whisperChildRunning: boolean
  ffmpegStderrTail: string
  whisperStderrTail: string
  whisperStdoutTail: string
}

/** Same path-based model as Scene Bank (`SceneFolder`). */
export type TranscriptionFolder = SceneFolder

export type TranscriptionItem = {
  id: string
  /** Slash-separated folder path, same semantics as `Scene.folder` (empty = library root). */
  folder: string
  sceneId: string | null
  name: string
  content: string
  sourceFilePath: string | null
  createdAt: string
  updatedAt: string
}

export type TranscriptionItemUpdateInput = {
  id: string
  folder?: string
  sceneId?: string | null
  name?: string
  content?: string
}
