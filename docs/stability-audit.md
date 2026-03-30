# Stabilitetsgjennomgang — full pass

**Dato:** 2026-03-30 (oppdatert etter systematisk fasegjennomgang).  
**Manuell UI-testing:** Ikke utført i denne runden (krever interaktiv app); se matrise nederst.

## Executive summary

Kodebasen **typekompilerer**, **lint er grønn**, **npm audit rapporterer 0 sårbarheter**, og **alle automatiserte tester** (23 enhet + 10 integrasjon per kjøring) passerer. Produksjons**bygg** (Vite + electron-builder) fullførte lokalt med exit 0. Hovedrisiko for videre utvikling ligger i **store enkeltfiler**, **begrenset dybdesjekk av JSON-snapshot-import**, og **språkblanding** i UI — ikke i åpenbar feil i IPC/DB for kjente flyter. I denne runden er IPC endepunktene `windows:updateGlobalUiState` og `windows:setDragSession` strammet inn med eksplisitt validering i `ipc-validators.ts`.

## Fase A — Automatisert baseline

| Sjekk | Resultat |
|-------|----------|
| `npm run lint` | OK |
| `npx tsc -b` | OK |
| `npm run test` (unit + integration) | OK — 23 + 10 tester |
| `npm audit` | 0 vulnerabilities |
| `npm run build` | OK — Vite + electron-builder (mac arm64); notarize hoppet over (forventet uten full config) |

**Merknader:** electron-builder kan fortsatt logge «Implicit publishing triggered by CI detection» hvis miljøvariabelen `CI` er satt; `publish: null` er konfigurert i `package.json`. Vite logget deprecation om `inlineDynamicImports` fra electron-plugin — lav prioritet.

## Fase B — IPC, preload, typer

- **ipcMain.handle:** ca. 74 registrerte handlere i `electron/main/ipc.ts`.
- **Preload** (`electron/preload/index.ts`) og **NarraLabApi** (`src/types/project.ts`) er i praksis i paritet med kanalene som brukes fra renderer; inkl. `boards:addScene`, `project:exportBoardScript`, `importShootLog`.
- **Validering:** De fleste muterende kall bruker `requireString` / `parse*` fra `ipc-validators.ts`.
- **Endring i denne passen:** `windows:updateGlobalUiState` og `windows:setDragSession` går nå via `parseGlobalUiStatePatch` og `parseWindowDragSession` (ingen rå `Partial<>`-spread fra ukjent IPC-payload).

## Fase C — Main, database, filer

- **Electron main:** `contextIsolation: true`, `nodeIntegration: false` i `electron/main/app.ts` (standard trygg profil for renderer).
- **Prosjekt/JSON:** `importJson` har trygg lesing + JSON-feil på norsk; `importShootLogWorkbook` fanger lese-/parse-feil og returnerer strukturert feil på arket `(fil)`.
- **Migreringer:** `electron/main/db/migrations.ts` + integrasjonstest `tests/integration/migrations.test.ts` — kjører grønt.
- **JSON.parse** andre steder: fortsatt steder i meta/settings-repositorier; forventer kontrollert input fra egen DB — akseptabelt med lav risiko så lenge snapshot-import ikke er strengt validert (se funn).

## Fase D — Renderer (React / Zustand)

- **Store:** `src/stores/app-store.ts` (~1368 linjer) — sentral; `runProjectAction` fanger feil til `error`-state.
- **Største fil:** `src/features/boards/outline-workspace.tsx` (~3055 linjer) — høy refaktoreringsgjeld før store nye board-features.
- **Drag:** `src/lib/scene-drag.ts` bruker try/catch rundt JSON-parse av drag-data.

## Fase E — Sikkerhet og avhengigheter

- **Preload:** Kun `contextBridge.exposeInMainWorld('narralab', api)` — ingen direkte Node i renderer.
- **Sandbox:** `sandbox: false` i BrowserWindow (vanlig for preload som trenger visse capabilities); risiko avhenger av at preload holder API-et minimalt — vurder `sandbox: true` på sikt hvis Electron-oppsett tillater det.
- **npm audit:** 0 issues på kjøretidspunktet.

## Fase F — Manuell smoke (matrise)

| Flyt | Status | Merknad |
|------|--------|---------|
| Opprett/åpne prosjekt | **Ikke kjørt** | Krever manuell kjøring i app |
| Scene-bank, mapper, filter | **Ikke kjørt** | — |
| Board/outline, dra scene | **Ikke kjørt** | — |
| Inspector, lagring | **Ikke kjørt** | — |
| Opptakslogg-import (OK + feil) | **Ikke kjørt** | Dekket delvis av integrasjonstester |
| JSON-import feil | **Ikke kjørt** | Delvis dekket av kodegang |
| Archive, settings | **Ikke kjørt** | — |
| Multi-window / layouts | **Ikke kjørt** | — |

## Funn (prioritert)

| Alvor | Område | Beskrivelse | Tiltak i denne runden |
|-------|--------|-------------|------------------------|
| Medium | IPC | Rå payload til global UI-state / drag session | **Fikset:** parsere i `ipc-validators.ts` |
| Medium | Vedlikehold | Monolitt `outline-workspace.tsx` | Dokumentert; refaktor senere |
| Low | UX | Tom opptakslogg-import (0 rader) gir lite feedback | Ingen endring |
| Low | i18n | Engelsk blanding i UI/dialoger | Ingen endring |
| Low | Data | `replaceWithSnapshot` uten streng skjema-validering | Ingen endring; anbefales senere |
| Info | Bygg | electron-builder CI/publish-advarsel, duplicate deps warning | Delvis adressert (`publish: null`); rest er tooling |

## Tidligere runde (beholdt oversikt)

1. Opptakslogg: strukturert feil ved korrupt `.xlsx` (`(fil)`).
2. JSON-import: norske feil ved I/O og ugyldig JSON.
3. UI-tekst for opptakslogg-feil: norsk.
4. `publish: null` i `package.json`.
5. Integrasjonstest for ugyldig xlsx.
6. `.gitignore`: `~$*`.

## Anbefalinger før større features

- Kjør `npm run check` i CI eller pre-push.
- Nye IPC-kanaler: alltid validator + test.
- Nye DB-felt: migrering + integrasjonstest.
- Planlegg utbrytning av `outline-workspace.tsx` parallelt med store board-endringer.
- Utfør manuell smoke-matrise (Fase F) ved release-kandidat.
