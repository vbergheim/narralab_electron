# Scene Bank dnd-kit Implementation

## Problem
Scene Bank intern reordering brukte bare native HTML drag-and-drop, som ikke ga smooth "push-and-shift" animasjoner eller gap-placeholders. Dette førte til hakking og "blinking" når scener ble dratt over hverandre.

## Løsning
Implementert dnd-kit i Scene Bank for intern reordering, på samme måte som Outline bruker det.

## Endringer

### 1. Imports
- Lagt til `DndContext`, `DragOverlay`, `PointerSensor`, `useSensor`, `useSensors` fra `@dnd-kit/core`
- Lagt til `SortableContext`, `useSortable`, `verticalListSortingStrategy` fra `@dnd-kit/sortable`
- Lagt til `CSS` fra `@dnd-kit/utilities`
- Lagt til `createPortal` fra `react-dom`

### 2. State i SceneBankView
- `activeDndKitDrag`: tracker hvilken scene som er aktiv i dnd-kit drag
- `dndKitInsertBeforeSceneId`: tracker hvor gap-placeholder skal vises
- `sensors`: konfigurert med `PointerSensor` og 8px activation distance

### 3. DndContext
Wrapped hele scene-listen i `DndContext` med:
- `handleDndKitDragStart`: setter active drag og drag session for cross-window drag
- `handleDndKitDragOver`: oppdaterer gap placeholder position
- `handleDndKitDragEnd`: håndterer reordering og folder moves
- `onDragCancel`: resetter state

### 4. SortableContext
- Hver folder-gruppe wrapped i egen `SortableContext` med items `scene:${sceneId}`
- Root scenes wrapped i egen `SortableContext`

### 5. SceneBankRow
- Bruker `useSortable` hook med `id: scene:${scene.id}`
- Setter `ref`, `style` (transform + transition) fra useSortable
- Listeners og attributes lagt på GripVertical handles
- Beholdt native `onDragOver`/`onDrop` for å motta cross-window drag fra andre vinduer

### 6. Gap Placeholders
- Viser `SceneReorderGap` før scene når `dndKitInsertBeforeSceneId` matcher
- Gap count basert på antall selected scenes
- Fallback til native drag gap for external drag sources

### 7. DragOverlay
- Viser `SceneCard` overlay under drag
- Posisjonert via portal til document.body
- Opacity 95%, ingen drop animation

## Cross-window Drag Support
- dnd-kit setter drag session i `handleDndKitDragStart`
- Native `onDragOver`/`onDrop` handlers beholdt for å motta external drag
- Drag session cleares i `handleDndKitDragEnd` (med 2s delay for cleanup)

## Ytelse
- Optimalisert `onDragOverScene` callbacks med functional state updates
- useRef for å unngå unødvendige re-renders når same scene ID
- Kun oppdaterer state når sceneId eller count faktisk endrer seg
