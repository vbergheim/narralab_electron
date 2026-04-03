import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcPath = path.join(root, "sample-data/shoot-log-template_v2_fiktive_data.xlsx");
const outPath = path.join(root, "sample-data/opptakslogg_tv_produsent_25scener.xlsx");

/** Excel duration for [m]:ss (same epoch as template). */
function dur(m, s = 0) {
  return new Date(Date.UTC(1899, 11, 30, 0, m, s));
}

function deep(o) {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}

function copyRowStyleFromSnapshot(ws, snap, rowIndex) {
  const row = ws.getRow(rowIndex);
  row.height = snap.height;
  for (let c = 1; c <= 13; c++) {
    const tgt = row.getCell(c);
    const s = snap.cells[c];
    if (!s) continue;
    if (s.font) tgt.font = deep(s.font);
    if (s.fill) tgt.fill = deep(s.fill);
    if (s.border) tgt.border = deep(s.border);
    if (s.alignment) tgt.alignment = deep(s.alignment);
    if (s.numFmt) tgt.numFmt = s.numFmt;
  }
}

const shootDate = new Date(2026, 3, 3, 8, 0, 0); // 3. apr. 2026 lokalt

const scenes = [
  {
    scene: "Telefonen før daggry",
    synopsis:
      "Jonas våkner av vibrasjon i nattbordet. Skjermen lyser opp med meldinger om endret sendeflate og en ukjent avsender.",
    who: "Jonas Klette",
    type: "Situasjon",
    fn: "Konflikt",
    rating: 4,
    notes:
      "Tett nærbilde av skjermrefleks i øyet. Bra rytme; vurder å kutte første push hvis åpningen blir for travel.",
    est: dur(1, 20),
    quote: "«Hvis dette er sant, rekker vi ikke møtet.»",
    loc: "Jonas' leilighet, Majorstuen",
    qual: "Sterk",
    folder: "LN_D01_A001",
  },
  {
    scene: "Kaffe og siste gjennomlesning",
    synopsis:
      "På kjøkkenbenken ligger utkast til behandling. Jonas blar kjapt mens kaffetrakteren bråker, og noterer tre spørsmål med tusj.",
    who: "Jonas Klette",
    type: "Observ.",
    fn: "Karakter",
    rating: 3,
    notes: "Fin kontrast til neste scene. Behold kjøkkenlyd lavt under.",
    est: dur(2, 5),
    quote: "Han sirkler ordet «kutt» to ganger.",
    loc: "Jonas' leilighet",
    qual: "Brukbar",
    folder: "LN_D01_A002",
  },
  {
    scene: "T-banen inn mot byen",
    synopsis:
      "Håndholdt gjennom vindu og folkemengde. Jonas sitter med AirPods og nikker til en kollega på telefon som avslutter brått.",
    who: "Jonas Klette, Thea (assistent, telefon)",
    type: "Miljø",
    fn: "Overgang",
    rating: 4,
    notes: "Flott etablering av Oslo-puls. Litt refleks i glass – OK for dokumentarisk tone.",
    est: dur(2, 40),
    quote: "«Jeg er på T-banen. Send agenda. Nå.»",
    loc: "T-banen (østgående)",
    qual: "Sterk",
    folder: "LN_D01_A003",
  },
  {
    scene: "Ankomst kanalen: sikkerhetssluse",
    synopsis:
      "ID-kort, pip, kort hall. Jonas hilser på vakten som kjenner ham igjen; en liten humoristisk avsporing før alvoret.",
    who: "Jonas Klette, vakt",
    type: "Situasjon",
    fn: "Stemning",
    rating: 3,
    notes: "Kort versjon til teaser. Lengre versjon kan bære montasje.",
    est: dur(1, 45),
    quote: "«Same procedure as every Thursday—bare verre i dag.»",
    loc: "Hovedinngang, Marienlyst",
    qual: "Brukbar",
    folder: "LN_D01_A004",
  },
  {
    scene: "Korridoren som aldri er tom",
    synopsis:
      "Jonas går kjapt forbi redaksjonsplakater og monitorer. Folk roper etter ham; han svarer med halvveis tommel opp uten å stoppe.",
    who: "Jonas Klette, flere kolleger (bak kamera)",
    type: "Miljø",
    fn: "Dramatikk",
    rating: 4,
    notes: "Sterk «hektisk hverdag»-scene. Vær obs på personvern i bakgrunn – slør ansikter ved behov.",
    est: dur(2, 15),
    quote: "En stemme bak ham: «De sitter allerede!»",
    loc: "Redaksjonskorridor",
    qual: "Sterk",
    folder: "LN_D01_A005",
  },
  {
    scene: "Krisebrief på kontoret",
    synopsis:
      "Thea legger en mappe på pulten. Jonas leser én linje, lukker øynene, åpner dem igjen. På veggen henger sendeplan som plutselig ser feil ut.",
    who: "Jonas Klette, Thea Holm (assistent)",
    type: "Samtale",
    fn: "Konflikt",
    rating: 5,
    notes: "Toppscene for spenning. Ta vare på stillheten etter setningen «hovedgjesten er ute».",
    est: dur(3, 10),
    quote: "«Hovedgjesten er ute. Og hovedgjesten var bærebjelken.»",
    loc: "Jonas' kontor",
    qual: "Sterk",
    folder: "LN_D01_A006",
  },
  {
    scene: "Impromptu-møte i møterom 3B",
    synopsis:
      "Lysstripene summer. Programleder, redaktør og Jonas barker over hverandre om erstatningsopplegg før kveldens direktesending.",
    who: "Jonas Klette, Lise Brandt (programleder), Per Malik (redaktør)",
    type: "Samtale",
    fn: "Konflikt",
    rating: 5,
    notes: "Flere kamera vinkel om mulig. Mye overlapp – transkripsjon blir viktig i klipp.",
    est: dur(4, 20),
    quote: "«Vi kan ikke late som dette er en vanlig torsdag.»",
    loc: "Møterom 3B",
    qual: "Sterk",
    folder: "LN_D01_A007",
  },
  {
    scene: "Røykpause som ikke er en pause",
    synopsis:
      "Jonas står under takutstikk. Han ringer en tidligere mentor, ber om råd, og får et svar han ikke liker.",
    who: "Jonas Klette, mentor (telefon)",
    type: "Samtale",
    fn: "Relasjon",
    rating: 4,
    notes: "Vind og bylyd gir naturlig dynamikk. Avslutt på nær reaksjon, ikke på forklaring.",
    est: dur(3, 45),
    quote: "«Du kan redde sendinga. Du kan ikke redde alle karrierer.»",
    loc: "Takterrasse / utendørs sone",
    qual: "Sterk",
    folder: "LN_D01_A008",
  },
  {
    scene: "Klippesuite: «ti minutter som føles som timer»",
    synopsis:
      "Jonas ser på en grovklipp med tomme felt der hovedgjesten skulle vært. Klipperen spoler fram og tilbake mens de tester tre ulike løsninger.",
    who: "Jonas Klette, Sindre Næss (klipper)",
    type: "Situasjon",
    fn: "Dramatikk",
    rating: 4,
    notes: "Skjerminnhold må ryddes juridisk før bruk. God forklaring av produksjonslogikk for publikum.",
    est: dur(3, 0),
    quote: "«Om vi maskerer med arkiv, må vi eie tonen.»",
    loc: "Klippesuite A",
    qual: "Brukbar",
    folder: "LN_D01_A009",
  },
  {
    scene: "Juridisk telefon: «det avhenger»",
    synopsis:
      "Jonas på hodetelefon, paralell tekst på skjerm. Advokatstemmen er rolig; Jonas tegner sirkler på notatark.",
    who: "Jonas Klette, advokat (telefon)",
    type: "Samtale",
    fn: "Konflikt",
    rating: 4,
    notes: "Unngå identifiserende detaljer i UI. Behold korte «ja/nei»-pauser.",
    est: dur(2, 50),
    quote: "«Avhenger av hva dere viser, og hvem dere viser det til.»",
    loc: "Kontor / lite redigeringsbord",
    qual: "Sterk",
    folder: "LN_D01_A010",
  },
  {
    scene: "Lunsj som ikke skjer",
    synopsis:
      "Thea legger en smoothie på pulten. Jonas tar én slurk, ser på klokka, skyver den bort og går.",
    who: "Jonas Klette, Thea Holm",
    type: "Observ.",
    fn: "Karakter",
    rating: 3,
    notes: "Liten, presis scene – god som bro mellom juridikk og øving.",
    est: dur(1, 10),
    quote: "Smoothien står igjen og skiller seg ut i den rotete pulten.",
    loc: "Kontor",
    qual: "Brukbar",
    folder: "LN_D01_A011",
  },
  {
    scene: "Øving i studio: «vi kjører plan B»",
    synopsis:
      "Lise prøver nye overganger. Lysmester og lyd krangler høflig om tid. Jonas står i periferien og ser ut som han bærer alt.",
    who: "Jonas Klette, Lise Brandt, teknisk team",
    type: "Situasjon",
    fn: "Stemning",
    rating: 4,
    notes: "Få med håndsignaler fra gulvleder. Kan brukes i montasje mot direkte.",
    est: dur(3, 35),
    quote: "«Plan B er ikke dårlig. Plan B er bare… synlig.»",
    loc: "Studio 2",
    qual: "Sterk",
    folder: "LN_D01_A012",
  },
  {
    scene: "Siste sjanse: gjest på tråden",
    synopsis:
      "Jonas forhandler med en potensiell erstatningsgjest som er skeptisk. Thea noterer forslag til spørsmål i margen.",
    who: "Jonas Klette, potensiell gjest (telefon), Thea Holm",
    type: "Samtale",
    fn: "Dramatikk",
    rating: 5,
    notes: "Hold telefonlyden ren. Avsluttningen (nervøs latter + ja) er gull.",
    est: dur(4, 0),
    quote: "«OK. Jeg gjør det. Men jeg vil ha en produsent i øret.»",
    loc: "Lite møterom",
    qual: "Sterk",
    folder: "LN_D01_A013",
  },
  {
    scene: "Koffert og stress: OB-utstyr i gangen",
    synopsis:
      "Kabeltromler, kameraesker, folk som teller sekunder. Jonas dobbeltsjekker liste mens han går baklengs mot utgang.",
    who: "Jonas Klette, OB-team",
    type: "Miljø",
    fn: "Overgang",
    rating: 3,
    notes: "Bruk som energiboost før «live». Lyd av hjul på linoleum er bra tekstur.",
    est: dur(2, 0),
    quote: "«Alt som ikke er i bilen nå, finnes ikke i kveld.»",
    loc: "Lastesone / baktrapp",
    qual: "Brukbar",
    folder: "LN_D01_A014",
  },
  {
    scene: "OB-bil ut av byen",
    synopsis:
      "Jonas i baksetet med headset rundt halsen. Utsikt gjennom rute, reflekser, korte meldinger på telefon.",
    who: "Jonas Klette, sjåfør (bak kamera)",
    type: "Observ.",
    fn: "Stemning",
    rating: 3,
    notes: "Kjør stabilisator eller monter på vindu. Vær obs på personer i trafikk.",
    est: dur(2, 25),
    quote: "Han stirrer på en melding som aldri blir sendt.",
    loc: "E18 / sentrum–vest",
    qual: "Brukbar",
    folder: "LN_D01_A015",
  },
  {
    scene: "Ankomst arena: siste sikkerhetsrunde",
    synopsis:
      "ID, armbånd, lang gang. Jonas hilser på kjente fjes fra tidligere sendinger; humoren er anstrengt.",
    who: "Jonas Klette, arrangementsvert",
    type: "Situasjon",
    fn: "Overgang",
    rating: 3,
    notes: "Etablerer location før kveldens klimaks.",
    est: dur(1, 55),
    quote: "«I kveld trenger vi ro på gulvet. Og tempo i kontrollrommet.»",
    loc: "Arena / kulturhus (fiktivt)",
    qual: "Brukbar",
    folder: "LN_D01_A016",
  },
  {
    scene: "Kontrollrom: «tikkende klokke»",
    synopsis:
      "Mange skjermer, talkback-sus, klokke på veggen. Regissør og Jonas står side om side og ser på nedtelling.",
    who: "Jonas Klette, regissør, lyd, bil",
    type: "Observ.",
    fn: "Dramatikk",
    rating: 5,
    notes: "Sterk lydflate. Ta vare på subtile blikk når tid kuttes.",
    est: dur(3, 20),
    quote: "«90 sekunder. Hvis ikke, går vi uten.»",
    loc: "Kontrollrom",
    qual: "Sterk",
    folder: "LN_D01_A017",
  },
  {
    scene: "Gulvet før direkte: programleder i silhuett",
    synopsis:
      "Lise sjekker ørepropp, sminker seg selv med fingeren, puster ut. Jonas gir en kort «du klarer det»-setning.",
    who: "Jonas Klette, Lise Brandt",
    type: "Samtale",
    fn: "Relasjon",
    rating: 4,
    notes: "Flott emosjonelt anker før sending. Hold dialog kort.",
    est: dur(2, 10),
    quote: "«Jeg trenger ikke pep talk. Jeg trenger at du tror på plan B.»",
    loc: "Backstage / gulv",
    qual: "Sterk",
    folder: "LN_D01_A018",
  },
  {
    scene: "Direkte: åpning som sklir (kontrollrom-perspektiv)",
    synopsis:
      "Vi ser programmet gå live på monitor. Første minutt har små tekniske hakk; stemningen i rommet strammes til.",
    who: "Team (kontrollrom)",
    type: "Situasjon",
    fn: "Dramatikk",
    rating: 5,
    notes: "Krever avklaring om bruk av sendebilde. Fokus på mennesker, ikke på innhold som ikke kan vises.",
    est: dur(3, 55),
    quote: "Talkback: «Hold. Hold. Kjør.»",
    loc: "Kontrollrom",
    qual: "Sterk",
    folder: "LN_D01_A019",
  },
  {
    scene: "Midt i sending: gjesten lander",
    synopsis:
      "Gjest ankommer i siste liten. Kamera følger håndtrykk, stresset latter, vei inn i lys.",
    who: "Jonas Klette, Lise Brandt, gjest",
    type: "Situasjon",
    fn: "Dramatikk",
    rating: 5,
    notes: "Fysisk koreografi – sikkerhet først. God «løsning i bevegelse».",
    est: dur(2, 35),
    quote: "«Du er inne. Du er inne. Løp.»",
    loc: "Backstage til studioområde",
    qual: "Sterk",
    folder: "LN_D01_A020",
  },
  {
    scene: "Ad-lib som redder segmentet",
    synopsis:
      "Lise snur en bom til en åpning. Jonas ser på monitor og slipper skuldrene et halvt hakk – ikke helt, men nok.",
    who: "Lise Brandt (send), Jonas Klette (kontrollrom/gulv)",
    type: "Situasjon",
    fn: "Relasjon",
    rating: 5,
    notes: "Kombiner sendelyd + reaksjon. Viktig for karakterbue.",
    est: dur(2, 5),
    quote: "«OK. Vi later som vi planla det.»",
    loc: "Studio / kontrollrom (klippet)",
    qual: "Sterk",
    folder: "LN_D01_A021",
  },
  {
    scene: "Siste minutt: avspilling av arkiv som lim",
    synopsis:
      "Klipper på signal fra kontrollrom. Jonas nikker mens arkivbilder fyller et hull publikum ikke skal merke.",
    who: "Jonas Klette, Sindre Næss (remote)",
    type: "Situasjon",
    fn: "Overgang",
    rating: 4,
    notes: "Forklarer fag uten å moralisere. Juridikk på arkiv må sjekkes.",
    est: dur(2, 30),
    quote: "«Lim er også journalistikk når klokka er ond.»",
    loc: "Kontrollrom",
    qual: "Brukbar",
    folder: "LN_D01_A022",
  },
  {
    scene: "Sort: eksosen av adrenalinet",
    synopsis:
      "Applaus (dempet), folk som pakker. Jonas sitter på en kasse og stirrer inn i veggen i tre sekunder for mye.",
    who: "Jonas Klette, crew",
    type: "Observ.",
    fn: "Avslutning",
    rating: 4,
    notes: "Bra bro til etterprat. Hold lengden – kraft i stillhet.",
    est: dur(2, 15),
    quote: "En tekniker legmer hånden på hans skulder, uten ord.",
    loc: "Backstage",
    qual: "Sterk",
    folder: "LN_D01_A023",
  },
  {
    scene: "Telefon fra kanalen: ris og risiko",
    synopsis:
      "Jonas går inn i en gang for å ta den «tunge» samtalen. Ansiktet skifter mellom lettelse og ny alarm.",
    who: "Jonas Klette, kanaldirigent (telefon)",
    type: "Samtale",
    fn: "Konflikt",
    rating: 5,
    notes: "Toppen av karrieredrama: ros for kvelden, men tydelig konsekvens framover.",
    est: dur(3, 40),
    quote: "«Du leverte. Men styret vil se tallene i morgen tidlig.»",
    loc: "Tom servicegang",
    qual: "Sterk",
    folder: "LN_D01_A024",
  },
  {
    scene: "Hjem: mørk gang, lys på telefonen",
    synopsis:
      "Jonas låser opp. På kjøleskapet lapp fra partneren. Han står stille, skriver ett kort svar, og blir stående.",
    who: "Jonas Klette",
    type: "Observ.",
    fn: "Avslutning",
    rating: 4,
    notes: "Åpen slutt som inviterer til videre episode. Unngå å overforklare.",
    est: dur(2, 55),
    quote: "Lappen: «Jeg er stolt. Sov litt.»",
    loc: "Jonas' leilighet",
    qual: "Sterk",
    folder: "LN_D01_A025",
  },
];

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(srcPath);
const ws = wb.getWorksheet("Scenes");
if (!ws) throw new Error("Mangler ark «Scenes»");

const templateRow = ws.getRow(11);
const snap = { height: templateRow.height, cells: {} };
for (let c = 1; c <= 13; c++) {
  const src = templateRow.getCell(c);
  snap.cells[c] = {
    font: src.font,
    fill: src.fill,
    border: src.border,
    alignment: src.alignment,
    numFmt: src.numFmt,
  };
}

const firstDataRow = 11;
const lastDataRow = firstDataRow + scenes.length - 1;

for (let r = firstDataRow; r <= lastDataRow; r++) {
  copyRowStyleFromSnapshot(ws, snap, r);
}

for (let i = 0; i < scenes.length; i++) {
  const s = scenes[i];
  const r = firstDataRow + i;
  const row = ws.getRow(r);
  row.getCell(1).value = i + 1;
  row.getCell(2).value = s.scene;
  row.getCell(3).value = s.synopsis;
  row.getCell(4).value = s.who;
  row.getCell(5).value = s.type;
  row.getCell(6).value = s.fn;
  row.getCell(7).value = s.rating;
  row.getCell(8).value = s.notes;
  row.getCell(9).value = s.est;
  row.getCell(10).value = s.quote;
  row.getCell(11).value = s.loc;
  row.getCell(12).value = s.qual;
  row.getCell(13).value = s.folder;
}

// Tøm eventuelle gjenværende scene-rader fra malens eksempel (mal hadde 8; vi har 25).
const templateHadUntil = 18;
for (let r = lastDataRow + 1; r <= templateHadUntil; r++) {
  copyRowStyleFromSnapshot(ws, snap, r);
  const row = ws.getRow(r);
  for (let c = 1; c <= 13; c++) row.getCell(c).value = null;
}

// Metadata (masterceller i henhold til malens merges)
ws.getRow(4).getCell(3).value = shootDate;
ws.getRow(4).getCell(5).value = "Mari Fjeld";
ws.getRow(4).getCell(6).value = "Mari Fjeld";

ws.getRow(5).getCell(3).value = "Oslo / Marienlyst + lokasjon OB";
ws.getRow(5).getCell(5).value = "Thomas Eriksen";
ws.getRow(5).getCell(6).value = "Thomas Eriksen";

ws.getRow(6).getCell(3).value = "Linje inn (bakom «Studio Nord»)";
ws.getRow(6).getCell(5).value = "Jonas Klette m.fl.";
ws.getRow(6).getCell(6).value = "Jonas Klette m.fl.";
ws.getRow(6).getCell(8).value = 25;

ws.getRow(4).getCell(8).value = "LINJE_INN_D01";
ws.getRow(5).getCell(8).value = "LN_D01_20260403_master";

const besk =
  "Dokumentaropptakene følger dramaseriens produsent Jonas Klette gjennom en enkelt dag der en kritisk gjest faller fra, sendeplanen sprekker, og en erstatningsløsning må spikres timer før direktesending. Dagen avsluttes med en telefon som både bekrefter kompetansen hans og flytter maktforholdet i kanalen.";

ws.getRow(7).getCell(3).value = besk;
ws.getRow(8).getCell(3).value = besk;

const sterkt =
  "Telefonsamtalen med kanalen etter sending (scene 24): presis blanding av anerkjennelse og trussel. Kombiner med kontrollrom-sekvensen (scene 17–19) for å vise både fag og politikk.";

const opp =
  "Følg opp neste innspillingsdag: møtet om «tallene», forhandling om sesongfornyelse, og intervju med programleder om tillit/risiko. Suppler med arkiv av tidligere suksess og fiasko (med samtykke).";

ws.getRow(9).getCell(3).value = sterkt;
ws.getRow(9).getCell(4).value = sterkt;
ws.getRow(9).getCell(6).value = opp;
ws.getRow(9).getCell(7).value = opp;
ws.getRow(9).getCell(8).value = opp;

await wb.xlsx.writeFile(outPath);
console.log("Skrev:", outPath);
