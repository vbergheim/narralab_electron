# Excel-import av opptakslogg

NarraLab kan importere en `.xlsx`-basert opptakslogg direkte til scene-banken. Importen er append-only: den legger til nye scener og beats, men endrer ikke boards, tags eller eksisterende scener.

## Anbefalt mal (OPPTAKSLOGG)

Bruk [sample-data/shoot-log-template.xlsx](../sample-data/shoot-log-template.xlsx) som utgangspunkt — arket `Scenes` har et layout med overskrift «OPPTAKSLOGG», metadata øverst og tabell fra rad med **Nr.**, **SCENE**, **SYNOPSIS** osv.

**Metadata (kolonne B = etikett, C / F = verdi):**

- **DATO:** — påkrevd, dato for opptaksdagen (`YYYY-MM-DD` eller `DD.MM.YYYY`). Brukes som **mappe i appen** (`scene.folder` = kun denne datoen).
- **STED:** — valgfritt; vises som **Opptakssted** i notatene på den første importerte scenen (brukes ikke som undermappe).
- **REGI:, FOTOGRAF:, PRODUKSJON:, CAST:, BESKRIVELSE:** — valgfritt; credits og første avsnitt av **BESKRIVELSE** legges inn øverst i **notater** på den første importerte scenen.

**Tabellkolonner (forventet rekkefølge som i malen):**

| Kolonne           | App-felt |
|-------------------|----------|
| Nr.               | `sort_order` + del av generert `scene_ref` |
| SCENE             | `title` |
| SYNOPSIS          | `synopsis` |
| LOCATION          | `location` |
| MEDVIRKENDE       | `characters` (komma, semikolon eller `\|` som skilletegn) |
| EST. TID          | `estimated_duration` i **sekunder**; i malen brukes tallformat **\[m\]:ss** (minutter:sekunder, f.eks. 1:30 = 1 min 30 s). Eldre filer med **h:mm** tolkes som timer:minutter. |
| RATING (1–5)      | `key_rating` |
| NOTATER           | `notes` |

`scene_ref` genereres automatisk (`<dato>_opptak_<nr>`). Arket **Beats** er valgfritt; hvis det finnes, gjelder kolonnene under.

## Teknisk alternativ (rad 1 = feltnavn)

Hvis første rad i `Scenes` inneholder overskriften `scene_ref`, brukes det kompakte formatet med engelske feltnavn (se tabellen under). Da kan du fylle alle felt appen støtter, inkludert `editorial_status`, `color`, `capture_status` osv.

`Scenes`:

- `scene_ref`
- `shoot_date`
- `shoot_block`
- `sort_order`
- `title`
- `synopsis`
- `location`
- `characters_pipe_separated`
- `category`
- `function`
- `estimated_duration_sec`
- `actual_duration_sec`
- `editorial_status`
- `key_rating`
- `color`
- `capture_status`
- `camera_notes`
- `audio_notes`
- `source_reference`
- `notes`

`Beats` (valgfritt ark):

- `scene_ref`
- `beat_order`
- `beat_text`

## Regler

- **OPPTAKSLOGG:** påkrevd gyldig **DATO**, og for hver datarad **SCENE** + **SYNOPSIS**.
- **Teknisk format:** påkrevd i `Scenes`: `scene_ref`, `shoot_date`, `title`, `synopsis`
- **Beats:** hvis arket finnes: påkrevd `scene_ref`, `beat_text` per rad med innhold
- `scene_ref` må være unik i workbooken (OPPTAKSLOGG: unikt scene-nummer per dato)
- `characters_pipe_separated` bruker `|` som skilletegn (teknisk format)
- `editorial_status` må være en av: `candidate`, `selected`, `maybe`, `omitted`, `locked`
- `capture_status` må være en av: `complete`, `partial`, `pickup`
- `color` må være en gyldig scene-farge fra appen

## Mapping til appen

- `shoot_date` eller `shoot_date/shoot_block` blir `scene.folder` (OPPTAKSLOGG: **kun DATO**; **STED** i notater)
- `category` mappes til `scene.category` (OPPTAKSLOGG: tom / `candidate`)
- `function` mappes til `scene.function`
- `source_reference` mappes til `scene.sourceReference` (OPPTAKSLOGG: filnavnet på workbooken)
- `characters_pipe_separated` / **MEDVIRKENDE** splittes til `scene.characters`
- `camera_notes`, `audio_notes`, `capture_status` og fri `notes` bygges inn i `scene.notes`; OPPTAKSLOGG legger dessuten metadata/credits foran på første scene
- `Beats` importeres som `scene.beats`

## Validering

Importen stopper før skriving hvis workbooken har feil, for eksempel:

- manglende ark `Scenes` eller ugyldige overskrifter
- ugyldig eller manglende **DATO** (OPPTAKSLOGG)
- duplikate `scene_ref` / scene-nummer
- ugyldige enum-verdier (teknisk format)
- ikke-numeriske tallfelt der det kreves tall
- beats som peker til en scene som ikke finnes i `Scenes`

Blanke rader og beats uten tekst ignoreres stille.
