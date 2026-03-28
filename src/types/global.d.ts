import type { DocuDocApi } from './project'

declare global {
  interface Window {
    docudoc: DocuDocApi
  }
}

export {}
