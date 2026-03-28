import { create } from 'zustand'

import type { SceneColor, SceneStatus } from '@/types/scene'

type FilterState = {
  search: string
  onlyKeyScenes: boolean
  selectedTagIds: string[]
  selectedStatuses: SceneStatus[]
  selectedColors: SceneColor[]
  selectedCategories: string[]
  setSearch(value: string): void
  toggleOnlyKeyScenes(): void
  toggleTag(tagId: string): void
  toggleStatus(status: SceneStatus): void
  toggleColor(color: SceneColor): void
  toggleCategory(category: string): void
  clear(): void
}

export const useFilterStore = create<FilterState>((set) => ({
  search: '',
  onlyKeyScenes: false,
  selectedTagIds: [],
  selectedStatuses: [],
  selectedColors: [],
  selectedCategories: [],
  setSearch: (search) => set({ search }),
  toggleOnlyKeyScenes: () =>
    set((state) => ({
      onlyKeyScenes: !state.onlyKeyScenes,
    })),
  toggleTag: (tagId) =>
    set((state) => ({
      selectedTagIds: state.selectedTagIds.includes(tagId)
        ? state.selectedTagIds.filter((entry) => entry !== tagId)
        : [...state.selectedTagIds, tagId],
    })),
  toggleStatus: (status) =>
    set((state) => ({
      selectedStatuses: state.selectedStatuses.includes(status)
        ? state.selectedStatuses.filter((entry) => entry !== status)
        : [...state.selectedStatuses, status],
    })),
  toggleColor: (color) =>
    set((state) => ({
      selectedColors: state.selectedColors.includes(color)
        ? state.selectedColors.filter((entry) => entry !== color)
        : [...state.selectedColors, color],
    })),
  toggleCategory: (category) =>
    set((state) => ({
      selectedCategories: state.selectedCategories.includes(category)
        ? state.selectedCategories.filter((entry) => entry !== category)
        : [...state.selectedCategories, category],
    })),
  clear: () =>
    set({
      search: '',
      onlyKeyScenes: false,
      selectedTagIds: [],
      selectedStatuses: [],
      selectedColors: [],
      selectedCategories: [],
    }),
}))
