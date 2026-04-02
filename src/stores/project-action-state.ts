export type ProjectActionState = {
  busy: boolean
  error: string | null
  pendingProjectActionCount: number
}

export function beginProjectAction(state: ProjectActionState) {
  const pendingProjectActionCount = state.pendingProjectActionCount + 1
  return {
    pendingProjectActionCount,
    busy: true,
    error: null,
  }
}

export function finishProjectAction(state: Pick<ProjectActionState, 'pendingProjectActionCount'>) {
  const pendingProjectActionCount = Math.max(0, state.pendingProjectActionCount - 1)
  return {
    pendingProjectActionCount,
    busy: pendingProjectActionCount > 0,
  }
}
