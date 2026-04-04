# TODO

Dette er arbeidslisten for å gjøre NarraLab til en tydelig alt-i-ett-løsning for dokumentarister. Produktarbeid prioriteres først. Teknisk og visuell polish støtter leveransene, men skal ikke styre roadmapet alene.

Se også [docs/product-roadmap.md](/Users/vegard/Desktop/DocuDoc/docs/product-roadmap.md).

## Nå: fase 0 og fase 1

- Definere kjerneflyten fra idé til opptaksplan: `Story -> Research -> Sources -> Scenes -> Shoot`.
- Låse første domenemodell for dokumentar: prosjektpremiss, tema, spørsmål, karakterer/kilder, research-notater og timeline-hendelser.
- Bestemme hvilke nye entiteter som må inn i SQLite nå, og hvilke som kan leve i notebook/UI først.
- Lage enkel informasjonsarkitektur for nye arbeidsflater uten å sprenge dagens app-shell.
- Lage egen `Story`-arbeidsflate med:
  - logline/premiss
  - tematikk
  - hovedspørsmål
  - foreløpig struktur i akter eller episoder
- Lage første versjon av `Kilder / karakterer`-register med status, rolle, kontaktinfo og narrativ funksjon.
- Lage første versjon av `Timeline` for sak, hendelser og milepæler.
- Koble scener mot karakterer/kilder og timeline-hendelser.
- Avklare om notebook skal bli fri skriveflate, eller om deler av innholdet skal løftes ut i strukturerte moduler.
- Validere fase 1 med ett ekte dokumentarprosjekt før fase 2 starter.

## Neste: fase 2

- Lage `Research hub` for notater, lenker, dokumenter, sitater og observasjoner.
- Lage enkel `bevis/påstand`-modell som lar brukeren koble påstand til kilde eller research-item.
- Innføre statusfelt for research og kilder: `ukjent`, `må verifiseres`, `verifisert`, `mangler motstemme`.
- Støtte tagging på tvers av scener, kilder, research og timeline.
- Lage visning for hull i historien: hvilke spørsmål er ubesvart, hvilke kilder mangler, hvilke scener savnes.
- Avgjøre om første versjon av vedlegg skal være filreferanser, eller om filer skal kopieres inn i prosjektet.

## Senere: fase 3

- Lage `Intervjupakker` med mål, hypotese, spørsmål, oppfølging og etterlogg.
- Lage `Opptaksplan` med location, dato, deltagere, crew, utstyr, tillatelser og risikoflagg.
- Lage `Shot wish list` per scene, sekvens eller opptaksdag.
- Lage rask feltlogg for observasjoner, lydmemo, stillbilder og raske notater.
- Vurdere kalender-eksport og enklere dagsplanutskrift.

## Senere: fase 4

- Lage seriemodus med episodeoversikt, episodebuer og deling av materiale mellom episoder.
- Lage rettighets- og arkivoversikt for arkivklipp, stills, musikk og lisensstatus.
- Lage eksport for treatment, pitch, episodeoversikt, intervjupakke og opptaksplan.
- Definere første håndoff til klipp/post: oversikter, sceneuttrekk og research-sammendrag.

## Ikke nå

- Full skylagring og samtidige flerbruker-redigeringer.
- Full media asset management med proxy, binning og tung filsynk.
- Avansert AI-generering før grunnmodellen for data og arbeidsflyt er på plass.
- Komplett juridisk/verktøysett for kontrakter og releases i første MVP.

## Teknisk støttearbeid

- Detachable `Inspector`-vindu for oppsett med to skjermer.
- Detachable `Filters + Boards`-vindu som valgfri sekundærflate dersom venstre arbeidsflate fortsatt trengs etter ny IA.
- Huske vindusplassering og panelstørrelser mellom appstarter.
- Legge inn tydelige shortcut-hints i UI for `Shift + 1` og `Shift + 2`.
- Finpusse `View`-dropdown så den matcher resten av kontrollene bedre.
- Gjøre `Table`-visningen enda mer Excel-lik med fastere kolonner og tynnere radhøyde.
- Forbedre selection-states mellom aktiv scene, flerutvalg og inspector-fokus.
- Vurdere enda tydeligere visuell separasjon mellom scener og strukturblokker.
- Legge inn diskret `Saving…` / `Saved`-indikator i inspector og notebook.
- Utvide notebooken til flere separate notater/faner i samme prosjekt.
- Lage en enkel note-list/sidebar for å bytte mellom notater raskt.
- Avklare om notater skal kunne knyttes til board, scene eller bare leve som frie prosjektnotater.
- Vurdere om blokker skal kunne foldes eller skjules per type.
- Egen rask kommando for å legge inn `Chapter`, `VO`, `Narration`, `Text Card` og `Note`.
- Vurdere bedre inline-redigering av blokker direkte i outline.
- CSV/Excel-import som neste steg etter JSON-import.
- Bedre Finder-integrasjon for `.docudoc`.
- Rydde navnekonvensjoner ved importerte prosjektfiler.
