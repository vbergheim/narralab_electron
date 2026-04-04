# Technical Backlog

Dette dokumentet samler restarbeid etter remediationsløpet. Punktene under er ikke akutte blokkere lenger, men de er fornuftige neste tekniske steg når det er tid til å jobbe videre med fundamentet.

## 1. Main-process decomposition

### `electron/main/project-service.ts`
- Status: mye bedre enn ved auditstart, men fortsatt stor.
- Hvorfor: fortsatt sentral for prosjektoperasjoner og fil-/meta-koordinasjon.
- Neste steg:
  - trekk ut flere rene domeneoperasjoner dersom nye features begynner å legge mer ansvar her
  - unngå at nye import/export-/meta-flows legges tilbake i denne filen

### `electron/main/transcription-service.ts`
- Status: sikkerhets- og jobbisolasjon er forbedret, men tjenesten er fortsatt bred.
- Hvorfor: nedlasting, binær-oppslag, ffmpeg/whisper-kjøring og diagnostikk lever i samme klasse.
- Neste steg:
  - vurder å splitte nedlasting/installasjon, job execution og diagnostics i egne moduler
  - legg kun mer transkripsjonslogikk her hvis den faktisk er prosessnær

## 2. Feature-rich renderer files to watch

Disse er ikke lenger åpenbare arkitekturproblemer, men bør overvåkes hvis nye features skal inn:

- `src/features/filters/filters-sidebar.tsx`
- `src/features/archive/archive-workspace.tsx`
- `src/components/board-selector/board-manager-dialog.tsx`
- `src/features/inspector/scene-inspector.tsx`
- `src/features/boards/outline-workspace-rows.tsx`
- `src/features/transcribe/components/transcription-library-sidebar.tsx`

Retningslinje:
- hvis en av disse får mer koordinasjonsansvar, trekk ut stateful container- eller helper-moduler tidlig
- hvis de bare vokser fordi de er rene presentasjonsflater, er det lavere prioritet

## 3. Electron/runtime test coverage

Testene er mye bedre enn før, men dette er fortsatt verdifulle neste steg:

- flere runtime-nære Electron smoke tests rundt fler-vindu-scenarier
- mer eksplisitt dekning av preload/IPC-kontrakter når nye capabilities legges til
- flere feilbanetester for avbrutte eller delvis mislykkede langkjøringer

## 4. Release hardening

Dette er ikke en akutt kodefeil, men et fremtidig produksjonsområde:

- signing/notarization/release-pipeline når distribusjon blir viktigere
- dokumentere forventet releaseflyt i repoet
- sikre at packaging-smoke fortsatt holdes grønn når native avhengigheter eller Electron-versjon endres

## 5. Repo hygiene

- hold scratch-filer og lokale eksperimenter ute av commits
- fortsett å holde lint/typecheck/test grønt per fase
- ikke la nye “god files” vokse frem i app-shell, store eller main-tjenestene igjen

## 6. Rule of thumb for future work

Når nye features legges til:

- renderer: skill mellom container, side effects og presentasjon tidlig
- main: skill mellom IPC entrypoint, service orchestration og ren domain-/IO-logikk
- preload: hold capabilities smale og eksplisitte
- persistence: bruk schema-backed strukturer når data får liv utover ren UI-meta

## 7. Media player follow-up

- `docs/media-player-rollback.md` beskriver den stabile linjen for `mpv + OSC` og hva som ble rullet tilbake.
- The current default skin is `ModernZ`, installed into the app-managed mpv config dir when available.
- Timecode is shown by default through the bundled `mpv-timecode.lua` script; `Ctrl+t` toggles it on and off.
- Embedded start timecode for pro formats is read in the main process with `ffprobe` and forwarded into the script so playback does not start at zero.
- Behold `MediaPlayerService`, IPC-kontrakten og controller-hooken hvis vi senere vil bygge egne kontroller.
- Ikke reintroduser native embed i runtime som standard uten en separat plan for macOS-bridge og robusthetstesting.
