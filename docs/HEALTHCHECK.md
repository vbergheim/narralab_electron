# Full Helsesjekk av DocuDoc

## Lederoppsummering
DocuDoc er fullt brukbar som lokal Electron-app, men den er ikke robust nok til 6-12 måneders rask featureutvikling uten målrettet hardening. Den største risikoen er ikke én enkelt bug, men at flere kjerneansvar er blandet sammen:

- renderer bestemmer for mye om board/window-kontekst
- `ProjectService`, `app-store` og `App.tsx` har blitt brede koordineringspunkter
- cross-window-flyter bygger på global UI-state og senere refresh-broadcasts
- repoet mangler tests og CI-bar for regressjoner i dataflyt og migrering

Konklusjon:
- dataintegriteten er foreløpig akseptabel for énbruker lokal desktop
- utvidbarheten er middelmådig og blir fort dårlig hvis flere store features lander uten opprydding
- neste fase bør prioritere typed contracts, domenesplitting og testbarhet før flere tunge workflow-features

## Arkitekturkart
Primær dataflyt i appen i dag:

1. `UI`
   - [src/app/App.tsx](/Users/vegard/Desktop/DocuDoc/src/app/App.tsx)
   - featurekomponenter som [src/features/boards/outline-workspace.tsx](/Users/vegard/Desktop/DocuDoc/src/features/boards/outline-workspace.tsx)
2. `Zustand`
   - [src/stores/app-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts)
   - [src/stores/filter-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/filter-store.ts)
3. `Preload`
   - [electron/preload/index.ts](/Users/vegard/Desktop/DocuDoc/electron/preload/index.ts)
4. `IPC`
   - [electron/main/ipc.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc.ts)
5. `Service`
   - [electron/main/project-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/project-service.ts)
   - [electron/main/window-manager.ts](/Users/vegard/Desktop/DocuDoc/electron/main/window-manager.ts)
   - [electron/main/app-settings-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/app-settings-service.ts)
6. `Repository`
   - [electron/main/db/repositories/scene-repository.ts](/Users/vegard/Desktop/DocuDoc/electron/main/db/repositories/scene-repository.ts)
   - [electron/main/db/repositories/board-repository.ts](/Users/vegard/Desktop/DocuDoc/electron/main/db/repositories/board-repository.ts)
   - [electron/main/db/repositories/archive-repository.ts](/Users/vegard/Desktop/DocuDoc/electron/main/db/repositories/archive-repository.ts)
7. `SQLite`
   - [electron/main/db/migrations.ts](/Users/vegard/Desktop/DocuDoc/electron/main/db/migrations.ts)

## Autoritative data og invariants
Dette må alltid holde:

### Database er autoritativ for:
- scenes
- scene beats
- boards
- board items
- archive folders/items
- tags
- project settings

### App settings er autoritative for:
- AI provider/model/system prompt
- saved layouts
- last project / last layout
- default density / default detached workspace

### Renderer-state er derived og må ikke bli “sannheten”
- `selectedSceneId`
- `selectedBoardItemId`
- `selectedSceneIds`
- `activeBoardId`
- kollaps-state for mapper og beats
- zoomnivå i board-view

### Kritiske invariants
- `board_items.position` må være sekvensielt og stabilt per board
- `scene_beats.sort_order` må være sekvensielt og stabilt per scene
- scene-data er globale; boards peker til scene-id, de eier ikke scenen
- structure blocks er board-lokale
- sletting av scene må rydde scene-referanser i boards
- migreringer må tåle gamle snapshot- og db-varianter uten delvise foreign-key-spor
- detached vinduer må operere på eksplisitt `boardId`, ikke implisitt globalt aktivt board

## Prioritert funnliste

### P0

#### 1. Globalt aktivt board og detached board-kontekst er for tett koblet
Berørte filer:
- [src/app/App.tsx](/Users/vegard/Desktop/DocuDoc/src/app/App.tsx)
- [src/stores/app-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts)
- [electron/main/window-manager.ts](/Users/vegard/Desktop/DocuDoc/electron/main/window-manager.ts)

Risiko:
- operasjoner i detached vinduer kan treffe feil board
- cross-window workflows blir skjøre
- visuelt “drop” kan se riktig ut uten at data faktisk oppdateres riktig sted

Tiltak:
- innfør eksplisitte board-targeted store-metoder
- ikke la detached workflows være avhengige av `activeBoardId`

Status i denne runden:
- delvis forbedret
- `addSceneToBoard(boardId, ...)` er innført i store-laget og brukt fra detached app-flyt
- detached board-flyt oppdaterer nå lokalt board-state mer deterministisk

#### 2. `App.tsx` er blitt en koordinatorkomponent med for mange ansvar
Risiko:
- høy regresjonsfare
- vanskelig å teste isolert
- vanskelig å se hva som er lokal view-logikk kontra global app-logikk

Tiltak:
- trekk ut `MainWorkspaceShell`
- trekk ut `DetachedWorkspaceShell`
- trekk ut `InspectorHost`
- flytt density/view/layout/window helpers bort fra `App.tsx`

#### 3. Cross-window drag mangler ett tydelig, ferdig internt kontraktslag
Berørte filer:
- [src/lib/scene-drag.ts](/Users/vegard/Desktop/DocuDoc/src/lib/scene-drag.ts)
- [electron/main/window-manager.ts](/Users/vegard/Desktop/DocuDoc/electron/main/window-manager.ts)
- [src/features/boards/outline-workspace.tsx](/Users/vegard/Desktop/DocuDoc/src/features/boards/outline-workspace.tsx)

Risiko:
- drag kan “se” riktig ut uten å committe data
- browser-native drag og app-global drag-session kan drive fra hverandre

Tiltak:
- gjør cross-window drag til eksplisitt domene med:
  - start
  - current payload
  - target resolve
  - commit
  - clear
- logg og test denne flyten spesifikt

### P1

#### 4. `ProjectService` er en god object
Risiko:
- vanskelig å forstå ansvar
- vanskelig å teste enkelte features uten full database/service-instans

Tiltak:
- splitt i:
  - `ProjectFileService`
  - `ProjectSettingsService`
  - `SceneDomainService`
  - `BoardDomainService`
  - `ArchiveDomainService`

#### 5. IPC-surface er typed, men ikke tydelig validert
Risiko:
- renderer kan sende ugyldige payloads
- feil blir sent oppdaget i repository-laget

Tiltak:
- innfør lette validatorer i `ipc.ts` eller service boundary
- valider ids, enum-felter og numeric bounds for board coordinates

Status i denne runden:
- delvis forbedret
- kritiske IPC-endepunkter valideres nå ved inngangen i [electron/main/ipc.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc.ts) via [electron/main/ipc-validators.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc-validators.ts)

#### 6. Secrets fallback til base64/plain er praktisk, men sikkerhetsmessig svak
Berørt fil:
- [electron/main/app-settings-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/app-settings-service.ts)

Tiltak:
- vis tydelig UI-varsel når safe storage ikke er tilgjengelig
- dokumenter at fallback ikke er ekte kryptering

Status i denne runden:
- forbedret
- settings viser nå eksplisitt varsel når appen ikke kan bruke safe storage

### P2

#### 7. README og repo-dokumentasjon henger etter faktisk produkt
Tiltak:
- oppdater README med:
  - arkitektur
  - prosjektfilformat
  - workspace-modell
  - utviklerløp

#### 8. Manglende tests og CI
Tiltak:
- legg inn minimum testbarriere før større features merges

Status i denne runden:
- forbedret
- repoet har nå unit-tester, SQLite integration-tester og CI-workflow for lint, typecheck og test

### P3

#### 9. Visuell konsistens og UI-polish har blitt styrt feature-for-feature
Tiltak:
- etabler design-kontrakter for:
  - panel headers
  - collapsed rails
  - inline editors
  - scene cards

## Korrigeringer gjort i denne hardeningsrunden
- Eksplisitt board-targeted add-scene-flyt i [src/stores/app-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts)
- Detached app-flyt bruker nå eksplisitt current board-target i [src/app/App.tsx](/Users/vegard/Desktop/DocuDoc/src/app/App.tsx)
- Cross-window drag-session er løftet til shared window-state i:
  - [electron/main/window-manager.ts](/Users/vegard/Desktop/DocuDoc/electron/main/window-manager.ts)
  - [electron/main/ipc.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc.ts)
  - [electron/preload/index.ts](/Users/vegard/Desktop/DocuDoc/electron/preload/index.ts)
  - [src/lib/scene-drag.ts](/Users/vegard/Desktop/DocuDoc/src/lib/scene-drag.ts)
- Runtime-validering av kritiske IPC-payloads i:
  - [electron/main/ipc.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc.ts)
  - [electron/main/ipc-validators.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc-validators.ts)
- Minimum kvalitetsgjerder i repoet:
  - [vitest.config.ts](/Users/vegard/Desktop/DocuDoc/vitest.config.ts)
  - [tests/unit/durations.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/durations.test.ts)
  - [tests/unit/scene-rating.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/scene-rating.test.ts)
  - [tests/unit/scene-drag.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/scene-drag.test.ts)
  - [tests/integration/scene-repository.test.ts](/Users/vegard/Desktop/DocuDoc/tests/integration/scene-repository.test.ts)
  - [tests/integration/board-repository.test.ts](/Users/vegard/Desktop/DocuDoc/tests/integration/board-repository.test.ts)
  - [tests/integration/archive-repository.test.ts](/Users/vegard/Desktop/DocuDoc/tests/integration/archive-repository.test.ts)
  - [tests/integration/migrations.test.ts](/Users/vegard/Desktop/DocuDoc/tests/integration/migrations.test.ts)
  - [scripts/run-integration-tests.mjs](/Users/vegard/Desktop/DocuDoc/scripts/run-integration-tests.mjs)
  - [package.json](/Users/vegard/Desktop/DocuDoc/package.json)
  - [.github/workflows/ci.yml](/Users/vegard/Desktop/DocuDoc/.github/workflows/ci.yml)
- Tydelig sikkerhetsadvarsel for plain/base64 secret fallback i:
  - [electron/main/app-settings-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/app-settings-service.ts)
  - [src/features/settings/settings-workspace.tsx](/Users/vegard/Desktop/DocuDoc/src/features/settings/settings-workspace.tsx)

## Minimum kvalitetsbar
Før neste større feature bør dette være grønt:

1. `eslint`
2. `tsc -b`
3. repository integration tests for:
   - scene create/update/delete
   - board add/remove/reorder
   - scene beat create/reorder/delete
   - archive add/move/delete
4. smoke/E2E for:
   - create/open/save-as
   - detached outline
   - cross-window selection sync
   - cross-window scene add

Status i repoet nå:
1. `eslint` finnes og er grønn
2. `tsc -b` finnes og er grønn
3. repository integration tests finnes og er grønne
4. smoke/E2E finnes fortsatt ikke og er fortsatt neste nivå

## Forslag til teststrategi

### Unit
- rene hjelpefunksjoner i `src/lib/*`
- sortering, label-formattering, drag parsing, rating og durations

### Integration
- repositories og `ProjectService` mot midlertidig sqlite-db

### Smoke / E2E
- Electron desktop flows:
  - create project
  - add scene
  - add block
  - save/open
  - detached outline

## 30 / 60 / 90 dager

### Nå
- stabiliser board/window-kontrakter
- legg inn minimum integration tests
- dokumenter arkitektur og invariants
- land cross-window drag eller parker det bak feature-flag/eksplisitt WIP

### Neste
- splitt `ProjectService`
- splitt `App.tsx`
- samle IPC-kontrakter og inputvalidering

### Senere
- bygg fullt robust cross-window interaction layer
- vurder notebook-domene som egne dokumentobjekter
- vurder undo/redo og transaksjonslogg for brukerhandlinger

## Anbefaling før videre featurearbeid
Ikke fortsett med flere store vindu-/layout-/canvas-features før minst disse er gjort:

1. store-metoder for eksplisitte board-targeted operasjoner
2. integration tests for board og scene repository
3. refaktorering av `App.tsx` til mindre shells/hosts
4. enten ferdig cross-window drag, eller tydelig avgrensning av hva som er støttet
