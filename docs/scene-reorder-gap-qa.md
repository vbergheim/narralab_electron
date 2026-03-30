# Scene Reorder Gap — Manual QA Plan

## Implementation Summary

Standardized the "room/push-and-shift" visual effect for scene drag-and-drop across the app, using Outline's existing animation as the reference.

### Changes Made

1. **Created shared component**: `src/components/ui/scene-reorder-gap.tsx`
   - Gap-only placeholder (no scene info displayed)
   - Supports `variant` ('outline' | 'bank') and `density` props
   - Dynamically adjusts height based on variant and density
   - Handles multi-scene drags via `count` prop

2. **Updated Outline** (`src/features/boards/outline-workspace.tsx`):
   - Added `nativeDraggedSceneCount` state
   - Updated `onDragOver` to capture scene count from `getDraggedSceneIds`
   - Replaced `OutlineInsertIndicator` with `SceneReorderGap` for native drag hover (both top and after-item positions)
   - Resets count on `onDragLeave`

3. **Updated Scene Bank** (`src/features/scenes/scene-bank-view.tsx`):
   - Added `dragOverSceneCount` state
   - Updated `SceneBankRow` to accept scene count in `onDragOverScene` callback
   - Removed absolute blue line indicator from `SceneBankRow`
   - Renders `SceneReorderGap` before the dragOver row (in both grouped and root scenes)
   - Updated `onDragOver` to call `getDraggedSceneIds` for consistency with Outline

4. **Added shared helper** (`src/lib/scene-drag.ts`):
   - Exported `getDraggedSceneIds` function that checks window drag session first, then falls back to native `DataTransfer`
   - Ensures consistent behavior across Outline and Scene Bank

## Manual QA Test Plan

### Test Scenario 1: Single Scene Drag from Scene Bank to Outline

1. Open the app and navigate to an Outline view with Scene Bank visible
2. Select a single scene in Scene Bank
3. Drag the scene over to the Outline area
4. **Expected**: As you hover between Outline rows, a single gap placeholder should appear, giving visual "room" for the scene
5. **Verify**: Gap height matches the existing Outline density (table/compact/detailed)
6. Drop the scene and verify it's inserted correctly

### Test Scenario 2: Multi-Select Drag from Scene Bank to Outline

1. In Scene Bank, select multiple scenes (Cmd+click or Shift+click)
2. Drag the selection over to the Outline area
3. **Expected**: Multiple gap placeholders should appear (one for each selected scene), showing room for all
4. **Verify**: Gap count matches the number of selected scenes
5. Drop and verify all scenes are inserted in order

### Test Scenario 3: Reorder Within Scene Bank

1. In Scene Bank, drag a scene and hover it over another scene
2. **Expected**: A gap placeholder should appear above the target scene (not a thin blue line)
3. **Verify**: Gap gives visual "room" effect (matches the reference from Outline)
4. Drop and verify reordering works correctly

### Test Scenario 4: Reorder Within Outline (Existing dnd-kit)

1. Within Outline, drag a scene to reorder it
2. **Expected**: Existing dnd-kit smooth animation should still work (not changed)
3. **Verify**: No regression in existing Outline internal reordering

### Visual Verification Checklist

- [ ] Gap placeholders have rounded corners and dashed borders
- [ ] Gap background is subtle (accent/[0.03])
- [ ] Gap height feels proportional to the scene card height in each density mode
- [ ] No visible scene info inside the gap (gap-only)
- [ ] Multi-scene drag shows appropriate number of gaps
- [ ] Smooth transitions when hovering over different positions
- [ ] No leftover blue line indicators anywhere

### Adjustments (if needed)

If gaps feel too tall or too short compared to actual scene cards:

1. Edit `src/components/ui/scene-reorder-gap.tsx`
2. Adjust height values in `getHeightClass` function:
   - Outline: table (44px), compact (88px), detailed (124px)
   - Bank: table (52px), compact (88px), detailed (136px)
3. Save and hot-reload should apply changes immediately

## Code Quality

- ✅ TypeScript compiles without errors
- ✅ No linter warnings
- ✅ Consistent API across components (`getDraggedSceneIds`)
- ✅ Proper state management (resets on drag leave/drop)
- ✅ Multi-scene support implemented
