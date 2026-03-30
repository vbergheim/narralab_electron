# Scene Bank Folder Selection - Manual QA

## Changes implemented

### 1. Event bubbling prevention
- Added `event.stopPropagation()` to both `onClick` and `onContextMenu` in `SceneBankRow`
- Prevents folder container selection handlers from intercepting scene clicks

### 2. Folder-local range selection
- `handleSelectionGesture` now uses `orderedScenes` (folder-local or root-local list) instead of global `scenes` list
- Shift+click range selection is now scoped within the same folder

### 3. Per-scope selection anchors
- Replaced `selectionAnchorRef` with `selectionAnchorByScopeRef` (Map<string, number>)
- Each scope (`folder:${folderPath}` or `root`) maintains its own anchor
- Implemented via getter/setter proxy in event handlers

## Manual test plan

### Test 1: Single select
- [ ] Click any scene inside a folder → only that scene should be selected
- [ ] Click another scene in the same folder → selection should move to that scene
- [ ] Click a scene in a different folder → selection should move to that scene

### Test 2: Toggle select (Cmd/Ctrl+click)
- [ ] Cmd/Ctrl+click multiple scenes inside the same folder → all should toggle correctly
- [ ] Cmd/Ctrl+click scenes across different folders → should work correctly

### Test 3: Shift range (within folder)
- [ ] Click scene A in folder 1
- [ ] Shift+click scene B in same folder → should select contiguous range from A to B
- [ ] All scenes between A and B in that folder should be selected

### Test 4: Shift range (cross-folder - should NOT range)
- [ ] Click scene in folder 1
- [ ] Shift+click scene in folder 2 → should behave like a normal click (select only folder 2 scene)
- [ ] Should NOT create a range across folders

### Test 5: Root scenes
- [ ] Shift+click range selection should work in root (loose scenes) independently
- [ ] Clicking in root, then Shift+clicking in a folder → should NOT range

### Test 6: Folder selection unchanged
- [ ] Click folder header → folder should be selected
- [ ] Folder selection should not interfere with scene selection

### Test 7: Context menu
- [ ] Right-click a scene inside a folder → scene becomes selected
- [ ] Context menu should appear at cursor position
- [ ] Folder should NOT steal the selection

## Expected behavior

- Scenes are selectable anywhere on the card
- Multi-select works freely within folders
- Shift+click range is scoped to current folder/root only
- Folder header selection remains functional
- No interference between folder and scene selection
