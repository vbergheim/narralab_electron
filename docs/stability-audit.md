# Stabilitetsgjennomgang (automatisk + kodelesing)

Dato: 2026-03-30. Kjørt uten manuell UI-testing.

## Automatiske sjekker (alle OK)

- `npm run lint` — ingen ESLint-feil
- `npx tsc -b` — prosjektet typekompilerer
- `npm run test` — 17 enhetstester + 10 integrasjonstester (inkl. migrasjoner, shoot-log-import, scene-drag)
- `npm run build` — Vite + electron main/preload bygger; `electron-builder --dir` fullfører pakking (signering avhenger av lokalt oppsett)

## Endringer gjort i denne runden

1. **Opptakslogg-import** (`importShootLogWorkbook`): Lesefeil / korrupt `.xlsx` gir nå et strukturert `ShootLogImportResult` med feil på arket `(fil)` i stedet for ukontrollert avbrudd i IPC.
2. **JSON-import**: Lesefeil og ugyldig JSON gir tydelige norske feilmeldinger i stedet for rå `JSON.parse`-kast.
3. **Feilmelding i UI** for opptakslogg: `formatShootLogImportErrors` er norsk (`Opptakslogg-import mislyktes`).
4. **electron-builder**: `publish: null` i `package.json` for å unngå implisitt publish-adferd i CI (advarsel i v26).
5. **Tester**: Ny integrasjonstest for ugyldig xlsx-fil.
6. **.gitignore**: `~$*` (Office-låsefiler).

## Observations (ikke endret nå)

- **Språk**: Noen strenger i appen er fortsatt engelske (menyer, dialogtitler i Electron); vurder samkjøring med norsk der det er produktkrav.
- **Tom vellykket opptakslogg-import** (0 nye scener, 0 feil): Brukeren får lite feedback — evt. toast «Ingen nye rader» senere.
- **Store kodefiler**: `outline-workspace.tsx` og `app-store.ts` er tunge; fremtidige features bør deles opp for vedlikehold.
- **JSON-import**: `replaceWithSnapshot` validerer ikke dypt — korrupt snapshot kan gi rare DB-tilstander; strengere validering kan komme senere.
- **Grafikk / duplikate maler** i `sample-data/` (kopier av xlsx): Rydd gjerne manuelt; kun `shoot-log-template.xlsx` er tenkt som kanonisk mal i repo.

## Anbefalinger før større features

- Behold `npm run check` i CI eller pre-push.
- Nye IPC-kanaler: følg eksisterende validators i `ipc-validators.ts`.
- Nye databasefelt: alltid migrering i `migrations.ts` + integrasjonstest.
