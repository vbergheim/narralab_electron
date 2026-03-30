type ComputeListSelectionInput = {
  id: string
  orderedIds: string[]
  selectedIds: string[]
  anchorIndex: number | null
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
}

type ComputeListSelectionResult = {
  nextSelectedIds: string[]
  nextAnchorIndex: number | null
}

export function computeListSelection({
  id,
  orderedIds,
  selectedIds,
  anchorIndex,
  shiftKey = false,
  metaKey = false,
  ctrlKey = false,
}: ComputeListSelectionInput): ComputeListSelectionResult {
  const index = orderedIds.indexOf(id)
  if (index < 0) {
    return {
      nextSelectedIds: selectedIds,
      nextAnchorIndex: anchorIndex,
    }
  }

  if (shiftKey && anchorIndex !== null) {
    const start = Math.min(anchorIndex, index)
    const end = Math.max(anchorIndex, index)
    return {
      nextSelectedIds: orderedIds.slice(start, end + 1),
      nextAnchorIndex: anchorIndex,
    }
  }

  if (metaKey || ctrlKey) {
    return {
      nextSelectedIds: selectedIds.includes(id)
        ? selectedIds.filter((entry) => entry !== id)
        : [...selectedIds, id],
      nextAnchorIndex: index,
    }
  }

  return {
    nextSelectedIds: [id],
    nextAnchorIndex: index,
  }
}

export function ensureContextSelection(id: string, selectedIds: string[], orderedIds: string[]) {
  if (selectedIds.includes(id)) {
    return selectedIds
  }

  return orderedIds.includes(id) ? [id] : selectedIds
}

export function comparePathDepthDesc(left: string, right: string) {
  return right.split('/').length - left.split('/').length
}
