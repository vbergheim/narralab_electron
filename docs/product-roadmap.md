# Product Roadmap: NarraLab for dokumentar

**Dato**: 2026-04-04  
**Status**: Aktiv planlegging

## 1. Mål

NarraLab skal utvikles fra en sceneorientert desktop-app til en reell arbeidsflate for dokumentarister som trenger ett sted for:

- idé og tematisk retning
- research og kildearbeid
- karakter- og sakskartlegging
- sceneutvikling og struktur
- intervju- og opptaksplanlegging
- håndoff til videre produksjon og klipp

Appen skal fortsatt være lokal-først og sterk på struktur. Nye funksjoner må derfor bygge på tydelige domeneobjekter og ikke bare flere fritekstflater.

## 2. Dagens utgangspunkt

NarraLab har allerede et godt fundament for:

- scene-bank og scene-metadata
- boards/outline som strukturflate
- notebook for fri tekst
- archive og transcribe som støttemoduler
- lokal SQLite-lagring og desktop-arbeidsflyt

Det som mangler for å bli en alt-i-ett-løsning for dokumentar er først og fremst støtte for arbeidet før scenene er ferdig definert:

- prosjektets premiss, tese og spørsmål
- kilder og karakterer som egne objekter
- research som kan spores og kobles til historie
- timeline for saken, ikke bare produksjonen
- intervju- og opptaksplanlegging

## 3. Produktprinsipper

Alle nye funksjoner bør følge disse prinsippene:

1. `Struktur før automasjon`
   AI og smarte forslag er nyttig, men først når prosjektdataene er tydelig modellert.

2. `Dokumentar først`
   Verktøyene skal speile hvordan dokumentar faktisk utvikles: spørsmål, kilder, observasjon, usikkerhet og revisjon.

3. `Lokal-først`
   Appen skal fungere godt uten skyavhengighet og være trygg for sensitiv research.

4. `Sporbarhet`
   Påstander, scener og avgjørelser bør kunne spores tilbake til research, kilder eller observasjoner.

5. `Stegvis levering`
   Hver fase skal gi reell verdi alene, uten å forutsette at hele sluttvisjonen er ferdig.

## 4. Prioritert roadmap

## Fase 0: Domene og arbeidsflyt

**Tidsmål**: 1-2 uker  
**Mål**: definere riktig produkt før flere features bygges

### Leveranser

- Beskrive kjerneflyt: `Story -> Research -> Sources -> Scenes -> Shoot`.
- Definere første dokumentar-domene i kode og database:
  - prosjektpremiss/logline
  - tema
  - hovedspørsmål
  - karakter/kilde
  - research-item
  - timeline-hendelse
- Bestemme relasjoner:
  - scene <-> kilde
  - scene <-> karakter
  - scene <-> timeline-hendelse
  - research-item <-> kilde
- Beslutte hva som er strukturert data og hva som fortsatt kan være notebook.

### Exit-kriterier

- Ett dokument som beskriver informasjonsarkitektur og domene er godkjent.
- Det er klart hvilke migreringer som trengs i fase 1.
- Det er klart hvilke flater som må inn i app-shell først.

## Fase 1: Story engine

**Tidsmål**: 2-4 uker  
**Mål**: gjøre appen nyttig før research-motoren er fullt utbygget

### Leveranser

- Ny `Story`-arbeidsflate.
- Felter for:
  - logline/premiss
  - tematikk
  - prosjektets hovedspørsmål
  - foreløpige akter eller episoder
  - karakteroversikt på høyt nivå
- Første versjon av `Kilder / karakterer`-register:
  - navn
  - rolle
  - kontaktstatus
  - tilgang
  - narrativ funksjon
  - risikonotat
- Første versjon av `Timeline`:
  - dato eller periode
  - hendelse
  - betydning for historien
  - kobling til kilder/scener
- Mulighet til å knytte scener til karakterer/kilder og timeline-punkter.

### Hvorfor denne fasen først

Dette flytter NarraLab fra "sceneorganisering" til "historiebygging". Uten dette blir senere research- og planleggingsverktøy løsrevet og mindre nyttige.

### Exit-kriterier

- En dokumentarist kan definere prosjektets kjerne uten å bruke eksterne dokumenter.
- Minst ett ekte prosjekt kan modelleres i appen med story, kilder og timeline.

## Fase 2: Research hub og beviskjede

**Tidsmål**: 3-5 uker  
**Mål**: samle og strukturere research slik at historien kan verifiseres og utvikles

### Leveranser

- Ny `Research`-arbeidsflate eller modul.
- Research-items med typer som:
  - notat
  - lenke
  - dokument
  - observasjon
  - sitat
- Statusflyt for research og kilder:
  - `ukjent`
  - `må verifiseres`
  - `verifisert`
  - `mangler motstemme`
- Enkel `påstand -> kilde`-kobling.
- Tverrgående tagging og filtrering mellom scener, research og kilder.
- Visning for narrative hull:
  - ubesvarte spørsmål
  - svake bevis
  - manglende perspektiver

### Exit-kriterier

- Brukeren kan se hvorfor en scene eller hypotese finnes.
- Brukeren kan oppdage hva som fortsatt ikke er godt nok dokumentert.

## Fase 3: Intervju og opptaksplan

**Tidsmål**: 3-5 uker  
**Mål**: gjøre appen brukbar i felt og under produksjonsplanlegging

### Leveranser

- `Intervjupakker`:
  - mål
  - hypotese
  - nøkkelspørsmål
  - oppfølgingsspørsmål
  - etterlogg
- `Opptaksplan`:
  - location
  - dato
  - deltagere
  - crew
  - utstyr
  - tillatelser
  - sikkerhets-/risikonotater
- `Shot wish list` per scene eller opptaksdag.
- Enkel `feltlogg` for raske observasjoner og notater.

### Exit-kriterier

- Et team kan planlegge en opptaksdag direkte i NarraLab.
- Intervjuforberedelse og etterarbeid kan leve i samme prosjekt som scenene.

## Fase 4: Serie, rettigheter og eksport

**Tidsmål**: 4-6 uker  
**Mål**: støtte større prosjekter og bedre håndoff

### Leveranser

- `Seriemodus` med episodeoversikt og sesonglogikk.
- `Rettighets- og arkivregister` for:
  - arkivklipp
  - bilder
  - musikk
  - lisensstatus
  - kilde og kostnad
- Eksportmaler for:
  - treatment
  - pitch
  - episodeoversikt
  - intervjupakke
  - opptaksplan
- Første post-/klippehåndoff med oversikter og sammendrag.

### Exit-kriterier

- Appen støtter både enkeltfilm og serie med bevisst forskjell i arbeidsflyt.
- Prosjektdata kan deles videre uten manuell klipp-og-lim fra flere dokumenter.

## 5. Tverrgående tekniske spor

Disse må løpe parallelt med roadmapet, men ikke kapre fokus:

- holde `ProjectService`, app-store og store renderer-filer under kontroll når nye domener legges inn
- legge til migreringer og tester for nye SQLite-entiteter
- styrke fler-vindu-scenarier når nye arbeidsflater kommer inn
- forbedre lagringsstatus, søk og filtrering på tvers av moduler
- sikre eksport/import for nye entiteter før datamodellen låses

## 6. Foreslått gjennomføringsrekkefølge

1. Spikre domene og IA i fase 0.
2. Bygg `Story`-arbeidsflate og kilde/karakter-register.
3. Bygg timeline og koblinger til scener.
4. Test med ekte prosjekt.
5. Bygg research hub og beviskjede.
6. Bygg intervju- og opptaksplan.
7. Utvid til serie, rettigheter og eksport.

## 7. Hva vi bevisst utsetter

For å unngå scope-bom i MVP:

- full skylagring
- sanntids-samarbeid
- tung media asset management
- omfattende AI-agentflyter som skriver halve prosjektet for brukeren
- avansert juridisk modul utover enkle statusfelt og notater

## 8. Anbefalt neste arbeidsøkt

Neste konkrete steg bør være å gjøre fase 0 helt eksplisitt:

1. Beskrive de nye domeneobjektene i TypeScript.
2. Velge hvilke som må inn i SQLite med en gang.
3. Skissere ny venstrenavigasjon eller workspace-modell for `Story`, `Research` og `Shoot`.
4. Lage første implementasjonsfase som bare dekker `Story`, `Kilder` og `Timeline`.
