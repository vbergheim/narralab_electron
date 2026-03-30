# Excel-mal for film breakdown

## Status

Appen har nå en egen direkte `.xlsx`-import for opptakslogg. Den anbefalte malen for dette sporet ligger i [sample-data/shoot-log-template.xlsx](/Users/vegard/Desktop/DocuDoc/sample-data/shoot-log-template.xlsx), og formatet er dokumentert i [docs/opptakslogg-import.md](/Users/vegard/Desktop/DocuDoc/docs/opptakslogg-import.md).

CSV-malene under er fortsatt nyttige som flat arbeidsflate for film breakdown og videre JSON-konvertering, men de er ikke hovedløpet for opptakslogg lenger.

Ja. Den enkleste Excel-vennlige varianten er å splitte JSON-strukturen i tre flate tabeller som kan åpnes og redigeres i Excel:

- `sample-data/film-breakdown-scenes-template.csv`
- `sample-data/film-breakdown-beats-template.csv`
- `sample-data/film-breakdown-board-items-template.csv`

Dette er ikke direkte import i appen ennå. Appen støtter fortsatt bare JSON-import, men CSV-malene er laget for å være en enkel arbeidsflate for råmateriale.

## Hvordan fylle ut fra råmateriale

### 1. Scener

Bruk `film-breakdown-scenes-template.csv` til én rad per scene.

Map slik:

- scene heading eller sekvensnavn -> `title`
- kort beskrivelse av hva som skjer -> `synopsis`
- original heading, kildeutdrag eller usikkerheter -> `notes`
- sted -> `location`
- medvirkende -> `characters_pipe_separated`
- dramaturgisk funksjon -> `function`
- opprinnelig kilde -> `source_reference`

`characters_pipe_separated` bruker `|` som skilletegn, for eksempel `Anna|Interviewer|Mother`.

### 2. Beats

Bruk `film-breakdown-beats-template.csv` til korte delslag inne i en scene.

- `scene_id` må matche en rad i scene-filen
- `sort_order` styrer rekkefølgen
- hold `text` kort og redaksjonelt, ikke full råtekst hvis dere vil unngå tunge imports

### 3. Board-struktur

Bruk `film-breakdown-board-items-template.csv` hvis dere også vil forberede outline-struktur:

- `kind=scene` refererer til eksisterende `scene_id`
- `chapter`, `voiceover`, `narration`, `text-card`, `note` er frie tekstblokker
- `board_id` kan være den samme for alle rader i første versjon

## Anbefalt arbeidsflyt

1. Lim inn råmateriale og del det i grove scener.
2. Fyll ut scene-CSV først.
3. Legg til beats i egen CSV.
4. Legg eventuelt inn kapittel, VO og tekstplakater i board-CSV.
5. Konverter CSV-ene til NarraLab JSON når dere vil importere.

## Hva som mangler i appen i dag

- Ingen direkte CSV/Excel-import
- Ingen innebygd konverter fra disse CSV-malene til `schemaVersion: 6` JSON

Hvis dere vil, er neste naturlige steg at vi lager en liten `csv -> narralab json`-konverter i repoet, slik at Excel faktisk blir importveien og ikke bare arbeidsformatet.
