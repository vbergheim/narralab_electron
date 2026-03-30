# Importkilder for scener og blokker

Dette notatet beskriver hvilke nettressurser som er mest nyttige som råkilder for NarraLab, og hvordan de bør mappes til appens datamodell.

## Kilder som faktisk er nyttige

### 1. Fullmanus

Best når målet er å importere `scene -> beats`.

- Script Slug: <https://www.scriptslug.com/>
- IMSDb: <https://imsdb.com/>
- SimplyScripts: <https://www.simplyscripts.com/>

Disse gir vanligvis manus med scene-headings som `INT.` / `EXT.`, lokasjon og tid på døgnet. Det gjør dem relativt enkle å parse til scener.

### 2. Transkripsjoner

Best når målet er å hente dialog eller VO-utkast, men svakere som automatisk scenegrunnlag.

- Scripts.com: <https://www.scripts.com/>

Transkripsjoner mangler ofte tydelige scene-headings. De fungerer derfor bedre som grunnlag for `voiceover`, `narration`, eller scene-notater enn som fullautomatisk sceneimport.

### 3. Struktur- og beat-analyser

Best når målet er å bygge `chapter`, `voiceover`, `narration`, `text-card` eller høyere strukturlag i et board.

- Final Draft Blog: <https://blog.finaldraft.com/>
- ScreenCraft analyser og “Anatomy of a Script”: <https://screencraft.org/>

Disse kildene er ikke gode som primær sceneimport, men de er nyttige som grunnlag for kapittelinndeling, vendepunkter og tematiske blokker.

## Hva som passer NarraLab best

NarraLab har to nivåer som bør fylles forskjellig:

- `Scene` er global prosjektdata med `title`, `synopsis`, `notes`, `location`, `characters`, `function`, `beats` og metadata.
- `Board`-items er outline-lag med enten `scene` eller tekstblokker av typene `chapter`, `voiceover`, `narration`, `text-card`, `note`.

Det betyr i praksis:

- Bruk fullmanus som råkilde for `scenes` og `scene.beats`.
- Bruk analyser, beat sheets og redaksjonelle oppsummeringer som råkilde for board-lokale blokker.
- Ikke prøv å tvinge alt inn i scene-tabellen. VO, tekstplakater og kapitteloverskrifter hører ofte hjemme som board-items, ikke som egne scener.

## Anbefalt mapping

### Fra manus

- Scene heading -> `scene.title`, `scene.location`, del av `scene.notes`
- Kort oppsummering av scenen -> `scene.synopsis`
- Underliggende handling/dialogeslag -> `scene.beats[]`
- Rolleliste i scenen -> `scene.characters`
- Dramaturgisk funksjon -> `scene.function`
- Kilde/URL/fil -> `scene.sourceReference`

### Fra transkripsjon

- Dialog som oppsummerer tematikk -> `voiceover` eller `narration`
- On-screen tekst -> `text-card`
- Løse observasjoner/usikker parsing -> `note`

### Fra beat sheet / analyse

- Akt eller sekvens -> `chapter`
- Tematisk overgang -> `narration` eller `note`
- Tids-/stedsmarkør -> `text-card`

## Praktisk anbefaling

Den mest robuste første versjonen er:

1. Hent manus fra Script Slug eller IMSDb.
2. Del opp på scene-headings.
3. Lag én NarraLab-scene per heading.
4. Lag 1-5 korte beats per scene, ikke rå fulltekst.
5. Legg chapter/VO/text-card inn i board etterpå.

Hvis kilden bare er transkripsjon:

1. Segmenter manuelt eller halvautomatisk i sekvenser.
2. Opprett grove scener først.
3. Bruk resten som `voiceover`, `narration` eller `note`.

## Juridisk note

Flere av nettstedene over publiserer manus for lesing eller undervisning, ikke nødvendigvis for redistribusjon. Bruk dem som arbeidsgrunnlag, men vær forsiktig med å lagre og distribuere full opphavsrettslig tekst videre som del av produktet.

## Repo-referanser

- Scene-typen: `src/types/scene.ts`
- Board- og blokktypene: `src/types/board.ts`
- Snapshot-format: `src/types/project.ts`
- Eksempeldata: `sample-data/mia-scenes.json`
