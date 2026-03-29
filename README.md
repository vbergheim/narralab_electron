# DocuDoc

DocuDoc er en lokal Electron-app for å strukturere dokumentarfilm scene for scene. Appen kjører med React i renderer, Electron i desktop-skallet og SQLite som prosjektformat.

## Status
- Lokal macOS-først desktop-app
- Prosjektdata lagres i `.docudoc`-filer
- Støtter scenes, boards, archive, notebook, settings og en innebygd AI-konsulent
- Har detached vinduer og lagrede layouts, men cross-window-interaksjon er fortsatt et aktivt robusthetsområde

## Arkitektur
Dataflyten går slik:

1. `src/*`
   - UI og workspaces
   - Zustand-store i [src/stores/app-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts)
2. `electron/preload/index.ts`
   - typed bridge mellom renderer og main
3. `electron/main/ipc.ts`
   - IPC-registrering og runtime-validering av payloads
4. `electron/main/project-service.ts`
   - domeneoperasjoner for prosjekt, scenes, boards, archive og notebook
5. `electron/main/db/repositories/*`
   - SQLite-repositories
6. `electron/main/db/migrations.ts`
   - schema- og kompatibilitetsmigreringer

Autoritative data:
- SQLite er sannhet for scenes, beats, boards, board items, archive og project settings
- app settings er sannhet for AI, layouts og enkelte globale UI-defaults
- renderer-state er avledet og må ikke bli vedvarende sannhet

Mer detaljert gjennomgang ligger i [docs/HEALTHCHECK.md](/Users/vegard/Desktop/DocuDoc/docs/HEALTHCHECK.md).

## Kjøring lokalt
Installer avhengigheter:

```bash
npm install
```

Start dev-app:

```bash
npm run dev
```

Bygg pakket app:

```bash
npm run build
```

Bygg pakkestruktur uten full release:

```bash
npm run build:dir
```

## Kvalitetsgjerder
Lint:

```bash
npm run lint
```

Typecheck:

```bash
npx tsc -b
```

Tester:

```bash
npm run test
```

Alt samlet:

```bash
npm run check
```

## Teststrategi
Repoet har nå et minimum av automatiske gjerder:

- unit-tester for rene hjelpefunksjoner i `src/lib`
- integration-tester for SQLite-repositories og migreringer
- CI-workflow i `.github/workflows/ci.yml` som kjører lint, typecheck og test

Det finnes fortsatt ikke full Electron E2E eller UI-smoke for alle arbeidsflyter. Det er neste nivå, ikke ferdig arbeid.

## Prosjektformat
Prosjektet lagres som en lokal SQLite-database med `.docudoc`-endelse.

Dette betyr:
- `Save As` kopierer den underliggende databasen
- migreringer skjer ved åpning
- import/export JSON er et eget snapshot-spor, ikke primær lagringsmotor

## Viktige invariants
- `board_items.position` skal være sekvensiell per board
- `scene_beats.sort_order` skal være sekvensiell per scene
- scene-data er globale på tvers av boards
- structure blocks er board-lokale
- sletting av scene må rydde scene-referanser i boards
- detached vinduer må bruke eksplisitt `boardId`, ikke bare global `activeBoardId`

## Arbeidsregler for videreutvikling
- Ikke legg store nye features rett i `App.tsx` eller `ProjectService` hvis logikken kan trekkes ut.
- Renderer skal ikke gjette intern main-process state når en eksplisitt kontrakt kan brukes.
- Nye IPC-kall bør valideres ved inngangen i `electron/main/ipc.ts`.
- Nye databaseendringer skal dekkes av migreringstest eller repository-test.

## Åpne tekniske temaer
- robust cross-window drag/drop
- videre splitting av `ProjectService`
- videre splitting av `App.tsx`
- ekte Electron smoke/E2E for kritiske arbeidsflyter
