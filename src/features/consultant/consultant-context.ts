import type {
  ConsultantContextPayload,
  ConsultantProactiveHint,
} from '@/types/ai'
import type { Board, BoardItem } from '@/types/board'
import type { ProjectMeta, ProjectSettings } from '@/types/project'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'

type WorkspaceMode =
  | 'outline'
  | 'bank'
  | 'notebook'
  | 'archive'
  | 'consultant'
  | 'settings'
  | 'board-manager'
  | 'transcribe'

type ConsultantContextInput = {
  projectMeta: ProjectMeta | null
  projectSettings: ProjectSettings | null
  workspaceMode: WorkspaceMode
  boards: Board[]
  scenes: Scene[]
  tags: Tag[]
  activeBoardId: string | null
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
}

export function buildConsultantContext(input: ConsultantContextInput): ConsultantContextPayload {
  const activeBoard = resolveActiveBoard(input.boards, input.activeBoardId)
  const sceneMap = new Map(input.scenes.map((scene) => [scene.id, scene]))
  const tagMap = new Map(input.tags.map((tag) => [tag.id, tag.name]))
  const selectedScene = input.selectedSceneId ? sceneMap.get(input.selectedSceneId) ?? null : null
  const selectedItem = activeBoard?.items.find((item) => item.id === input.selectedBoardItemId) ?? null

  const ambientLines = [
    input.projectMeta ? `Project: ${input.projectSettings?.title?.trim() || input.projectMeta.name}` : 'Project: none',
    `Workspace: ${workspaceLabel(input.workspaceMode)}`,
    activeBoard ? `Active board: ${activeBoard.name}` : 'Active board: none',
    selectedScene ? `Focused scene: ${selectedScene.title || 'Untitled scene'}` : null,
    selectedItem && selectedItem.kind !== 'scene'
      ? `Focused block: ${selectedItem.kind} - ${trimLine(selectedItem.title || selectedItem.body, 80)}`
      : null,
    input.selectedSceneIds.length > 1 ? `Multi-selection: ${input.selectedSceneIds.length} scenes` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const focusedSections: string[] = []

  if (selectedScene) {
    focusedSections.push(buildSceneSection(selectedScene, tagMap))
  }

  if (activeBoard) {
    focusedSections.push(buildBoardSection(activeBoard, sceneMap, tagMap))
  }

  return {
    ambient: ambientLines,
    focused: focusedSections.filter(Boolean).join('\n\n') || undefined,
  }
}

export function buildConsultantContextSummary(input: ConsultantContextInput) {
  const activeBoard = resolveActiveBoard(input.boards, input.activeBoardId)
  const selectedScene = input.selectedSceneId
    ? input.scenes.find((scene) => scene.id === input.selectedSceneId) ?? null
    : null

  return [
    workspaceLabel(input.workspaceMode),
    activeBoard ? activeBoard.name : null,
    selectedScene ? selectedScene.title || 'Untitled scene' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function inferConsultantHint(input: ConsultantContextInput): ConsultantProactiveHint | null {
  const activeBoard = resolveActiveBoard(input.boards, input.activeBoardId)
  if (!activeBoard) {
    return null
  }

  if (activeBoard.items.length === 0) {
    return {
      id: `empty-board:${activeBoard.id}`,
      title: 'Tomt board',
      prompt: `Gi meg en enkel startpakke for boardet "${activeBoard.name}" med 3-5 anker-scener eller blokker.`,
      reason: 'Boardet er tomt. Konsulenten kan foreslå en startstruktur.',
    }
  }

  const sceneMap = new Map(input.scenes.map((scene) => [scene.id, scene]))
  const boardScenes = activeBoard.items
    .filter((item): item is Extract<BoardItem, { kind: 'scene' }> => item.kind === 'scene')
    .map((item) => sceneMap.get(item.sceneId))
    .filter((scene): scene is Scene => Boolean(scene))

  const incompleteScenes = boardScenes.filter(
    (scene) => !scene.title.trim() || !scene.synopsis.trim() || !scene.category.trim(),
  )

  if (incompleteScenes.length >= 3) {
    return {
      id: `missing-scene-detail:${activeBoard.id}:${incompleteScenes.length}`,
      title: 'Flere scener er uferdige',
      prompt: `Se på boardet "${activeBoard.name}" og foreslå hvilke scener som bør strammes opp først, og hva som mangler i hver.`,
      reason: `${incompleteScenes.length} scener mangler tittel, synopsis eller kategori.`,
    }
  }

  const textItems = activeBoard.items.filter((item) => item.kind !== 'scene')
  if (textItems.length >= 5 && textItems.length >= boardScenes.length) {
    return {
      id: `note-heavy:${activeBoard.id}:${textItems.length}`,
      title: 'Mange blokker, få scener',
      prompt: `Vurder om boardet "${activeBoard.name}" har for mange tekstblokker i forhold til konkrete scener, og foreslå en strammere struktur.`,
      reason: 'Boardet virker notattungt og kan trenge tydeligere sceneankre.',
    }
  }

  const categories = boardScenes.map((scene) => scene.category.trim()).filter(Boolean)
  const repeatedCategory = mostCommon(categories)
  if (repeatedCategory && repeatedCategory.count >= 4 && categories.length >= 6) {
    return {
      id: `repeated-category:${activeBoard.id}:${repeatedCategory.value}`,
      title: 'Lite variasjon i kategorier',
      prompt: `Se på boardet "${activeBoard.name}" og vurder om dramaturgien blir for ensartet. Foreslå hvor variasjonen bør økes.`,
      reason: `Mange scener er merket som "${repeatedCategory.value}".`,
    }
  }

  return null
}

function buildSceneSection(scene: Scene, tagMap: Map<string, string>) {
  const tagNames = scene.tagIds.map((tagId) => tagMap.get(tagId)).filter(Boolean).join(', ') || '-'
  return [
    'Focused scene:',
    `Title: ${scene.title || 'Untitled scene'}`,
    `Synopsis: ${trimLine(scene.synopsis, 280) || '-'}`,
    `Category: ${scene.category || '-'}`,
    `Key rating: ${scene.keyRating}/5`,
    `Tags: ${tagNames}`,
  ].join('\n')
}

function buildBoardSection(activeBoard: Board, sceneMap: Map<string, Scene>, tagMap: Map<string, string>) {
  const lines = activeBoard.items.slice(0, 24).map((item, index) => {
    if (item.kind === 'scene') {
      const scene = sceneMap.get(item.sceneId)
      if (!scene) {
        return `${index + 1}. Missing scene`
      }

      const tagNames = scene.tagIds.map((tagId) => tagMap.get(tagId)).filter(Boolean).join(', ') || '-'
      return `${index + 1}. Scene: ${scene.title || 'Untitled'} | Synopsis: ${trimLine(scene.synopsis, 120) || '-'} | Category: ${scene.category || '-'} | Tags: ${tagNames}`
    }

    return `${index + 1}. ${item.kind}: ${trimLine(item.title || item.body, 120) || '-'}`
  })

  return ['Active board outline:', ...lines].join('\n')
}

function resolveActiveBoard(boards: Board[], activeBoardId: string | null) {
  return boards.find((board) => board.id === activeBoardId) ?? boards[0] ?? null
}

function workspaceLabel(workspaceMode: WorkspaceMode) {
  switch (workspaceMode) {
    case 'outline':
      return 'Outline'
    case 'bank':
      return 'Scene Bank'
    case 'notebook':
      return 'Notebook'
    case 'archive':
      return 'Archive'
    case 'consultant':
      return 'Consultant'
    case 'settings':
      return 'Settings'
    case 'board-manager':
      return 'Board Manager'
    case 'transcribe':
      return 'Transcribe'
  }
}

function trimLine(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  let result: { value: string; count: number } | null = null
  for (const [value, count] of counts) {
    if (!result || count > result.count) {
      result = { value, count }
    }
  }

  return result
}
