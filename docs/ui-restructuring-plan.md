# UI Restructuring Plan: Panel Reorganization

**Date**: 2026-03-30  
**Status**: Planning

## Current Structure

### Left Panel (FiltersSidebar)
Currently contains two distinct sections:
1. **Board Management**
   - Board folders with collapse/expand
   - Board list grouped by folders
   - Create/edit/delete boards and folders
   - Drag-and-drop reordering
   - Board selection (sets active board)

2. **Scene Filters**
   - Tags filter
   - Categories filter
   - Status filter (including "Key Scenes")
   - Color filter
   - Clear all filters button

### Middle Area
- Workspace tabs: Outline, Scene Bank, Notebook, Archive
- Active workspace content

### Right Panel (Inspector)
- Scene inspector
- Board item inspector
- Bulk scene inspector
- Board inspector

## Problem Statement

1. **Board selection feels disconnected**: Må gå til venstre panel for å velge board, selv når man jobber i Outline
2. **Scene filters hører til Scene Bank**: Filtrene gjelder scene-innholdet, men er separert fra Scene Bank
3. **Venstre panel har blandet ansvar**: Board management + scene filtering = ulogisk gruppering

## Proposed New Structure

### Option A: Board Navigation in Outline Header

**Outline Workspace:**
- Add board dropdown/selector in header
- Shows current board name
- Click to open board selector popup/dropdown
- Quick create new board button
- Board folders shown in dropdown hierarchy

**Scene Bank:**
- Integrate scene filters directly into Scene Bank header/toolbar
- Collapsible filter section at top
- Filters apply to Scene Bank content in real-time
- "Clear filters" button when filters are active

**Left Panel:**
- Repurpose or remove entirely
- Could become collapsible board navigation (like VS Code sidebar)
- Or remove and gain more screen space

**Benefits:**
- Board selection where you use it (in Outline)
- Scene filters where they're relevant (in Scene Bank)
- More contextual and intuitive workflow
- Cleaner separation of concerns

### Option B: Compact Board Selector Bar

**Top Navigation Bar:**
- Add board selector between project toolbar and workspace tabs
- Horizontal board list/dropdown
- Always visible, no need for separate panel

**Scene Bank:**
- Same as Option A - integrate filters

**Left Panel:**
- Remove completely
- Gain horizontal space

### Option C: Keep Left Panel, Reorganize Content

**Left Panel - Board Navigator:**
- Only board management (folders, boards, reordering)
- Rename to "Boards" or "Navigation"
- Collapsible like current

**Scene Bank:**
- Integrate all scene filters directly
- Collapsible filters section

**Outline:**
- Board selector in header (minimal, just dropdown)

## Recommended Approach: User-Confirmed Design

**User Decisions:**
1. Board selector: Dropdown with "Manage Boards..." option to open full manager
2. Left panel: Remove completely
3. Scene Bank filters: Collapsible section
4. Board organization: Full manager dialog preserves folder/reorder capabilities

### Phase 1: Create Board Selector Dropdown Component
**File**: `src/components/board-selector/board-selector-dropdown.tsx`
- Dropdown showing boards grouped by folders
- Quick board selection (click to switch)
- "Manage Boards..." button at bottom
- Search/filter capability for many boards
- Compact, lightweight component

### Phase 2: Create Board Manager Dialog
**File**: `src/components/board-selector/board-manager-dialog.tsx`
- Full-screen or large modal dialog
- Complete board organization (from current FiltersSidebar)
- Board folders with create/edit/delete
- Drag-and-drop reordering
- Board create/edit/delete/duplicate
- Close button, keyboard shortcuts (Escape, Cmd+K)

### Phase 3: Add Board Selector to Outline Header
**File**: `src/features/boards/outline-workspace.tsx`
- Add board selector button next to view mode toggle
- Shows active board name (truncated if long)
- Chevron icon indicating dropdown
- Opens BoardSelectorDropdown on click
- "Manage Boards..." opens BoardManagerDialog

### Phase 4: Extract and Move Scene Filters to Scene Bank
**Files**: 
- Extract from `src/features/filters/filters-sidebar.tsx`
- Create `src/features/scenes/scene-bank-filters.tsx`
- Integrate into `src/features/scenes/scene-bank-view.tsx`

**Layout**:
- Collapsible section at top of Scene Bank
- Toggle button in Scene Bank header
- Shows active filter count badge when collapsed
- Uses existing `useFilterStore` (no state changes needed)

### Phase 5: Remove Left Panel
**File**: `src/app/App.tsx`
- Remove `leftCollapsed` state
- Remove FiltersSidebar rendering
- Update grid layout from `300px minmax(0,1fr)` to just `minmax(0,1fr)`
- Remove collapse/expand button
- Remove CollapsedRail for left side

### Phase 6: Clean Up
- Delete `src/features/filters/filters-sidebar.tsx` (or keep for reference)
- Update any saved window layout references
- Test all board workflows
- Test all scene filter workflows

## Detailed Component Design

### BoardSelectorDropdown Structure:
```
┌─ Board Selector ─────────────────┐
│ Search: [_______________]        │
├──────────────────────────────────┤
│ 📁 Production                    │
│   • Main Storyline         [*]   │
│   • B-Roll Coverage              │
│ 📁 Planning                      │
│   • Shot List Draft              │
│ ──────────────────────────────── │
│ • Uncategorized Board            │
├──────────────────────────────────┤
│ [+ New Board]  [⚙️ Manage...]    │
└──────────────────────────────────┘
```

### BoardManagerDialog Structure:
```
┌─ Manage Boards ──────────────────────────────────────┐
│                                                 [×]   │
│  [Search boards...]                                   │
│                                                       │
│  📁 Production                              [+] [⋮]  │
│    • Main Storyline                    [*]      [⋮]  │
│    • B-Roll Coverage                            [⋮]  │
│                                                       │
│  📁 Planning                                [+] [⋮]  │
│    • Shot List Draft                            [⋮]  │
│                                                       │
│  • Uncategorized Board                          [⋮]  │
│                                                       │
│  [+ New Board]  [+ New Folder]                       │
│                                                       │
└───────────────────────────────────────────────────────┘
```
(Essentially the current FiltersSidebar boards section, but in a dialog)

### SceneBankFilters Structure (collapsed):
```
Scene Bank  [Filters: 3 active ▼]  [+]
```

### SceneBankFilters Structure (expanded):
```
┌─ Scene Bank ─────────────────────────────────────────┐
│  [Filters ▲]  [Clear]                           [+]  │
│                                                       │
│  Tags:     [Action] [Drama] [Outdoor] ...            │
│  Status:   [⭐ Key Scenes] [Draft] [Final] ...       │
│  Color:    [🔴] [🟢] [🔵] [🟡] ...                  │
│  Category: [Interview] [B-Roll] ...                  │
│                                                       │
│  ───────────────────────────────────────────────────  │
│  [Scene cards...]                                     │
└───────────────────────────────────────────────────────┘
```

## Implementation Order

1. ✅ **Commit current changes** (inline editing, folder behavior)
2. Create `BoardSelectorDropdown` component (standalone, reusable)
3. Create `BoardManagerDialog` component (port from FiltersSidebar)
4. Integrate board selector into Outline header
5. Create `SceneBankFilters` component
6. Integrate filters into Scene Bank
7. Remove left panel from App.tsx
8. Clean up FiltersSidebar
9. Test complete workflow

## Testing Checklist

- [ ] Board selection from Outline works
- [ ] Board manager opens and closes properly
- [ ] Board folders can be created/edited/deleted
- [ ] Boards can be reordered via drag-and-drop
- [ ] Scene Bank filters work correctly
- [ ] Filters collapse/expand smoothly
- [ ] Clear filters works
- [ ] No layout issues after left panel removal
- [ ] Keyboard shortcuts still work
- [ ] Multi-window layouts handle missing left panel gracefully

## Impact Assessment

### Files to Modify:
- `src/app/App.tsx` - Layout grid, panel rendering
- `src/features/boards/outline-workspace.tsx` - Add board selector
- `src/features/scenes/scene-bank-view.tsx` - Add filters
- `src/features/filters/filters-sidebar.tsx` - Potentially remove or refactor

### New Components:
- `src/components/board-selector/board-selector.tsx` - Reusable board picker
- `src/features/scenes/scene-bank-filters.tsx` - Filter chips for Scene Bank

### State Management:
- `useFilterStore` - No changes needed (already works globally)
- `useAppStore` - No major changes needed

### Backward Compatibility:
- Saved layouts may reference left panel state
- Gracefully handle missing/changed panel references
