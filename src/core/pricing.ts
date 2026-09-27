export type Prozent = number;

export interface ZutatEingabe {
  einkaufspreis_netto: number;
  einkaufsmenge: number;
}

export interface RezeptZutatenEingabe {
  menge: number;
  zutat?: ZutatEingabe;
  unterrezept?: RezeptEingabe;
  verschnitt_pct?: Prozent;
  garverlust_pct?: Prozent;
  schwund_pct?: Prozent;
}

export interface PersonalzeitEingabe {
  vorbereitung_min?: number;
  produktion_min?: number;
  anrichten_min?: number;
  batch_groesse?: number;
  personalkategorie?: {
    stundensatz_ag_gesamt: number;
  };
}

export interface RezeptEingabe {
  id?: string;
  name?: string;
  portionsgroesse?: number;
  ist_unterrezept?: boolean;
  verkaufspreis_netto?: number;
  zutaten?: RezeptZutatenEingabe[];
  arbeitszeit?: PersonalzeitEingabe[];
}

export interface FixkostenEingabe {
  betrag_monat: number;
}

export interface AuslastungEingabe {
  monat: string;
  verkaufte_speisen?: number;
}

export interface SteuersatzEingabe {
  satz_pct?: number;
}

export interface VerkaufskanalEingabe {
  id?: string;
  name?: string;
  provision_pct?: number;
  kartengebuehr_pct?: number;
  steuersatz?: SteuersatzEingabe;
}

export interface ZielEingabe {
  ziel_typ: 'db_quote' | 'gewinn_eur';
  wert: number;
}

export interface KalkulationsInput {
  rezept: RezeptEingabe;
  fixkosten?: FixkostenEingabe[];
  auslastung?: AuslastungEingabe[];
  verkaufskanale?: VerkaufskanalEingabe[];
  ziel: ZielEingabe;
}

export interface KalkulationsErgebnis {
  wareneinsatz: number;
  personalkosten: number;
  fixkosten_anteil: number;
  selbstkosten: number;
  je_kanal: Array<{
    kanal: VerkaufskanalEingabe;
    mindestpreis_netto: number;
    empfohlener_preis_netto: number;
    preis_brutto: number;
    db: number;
    db_quote: number;
  }>;
}

function normalizePercent(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return value > 1 ? value / 100 : value;
}

function getLatestPortions(auslastung: AuslastungEingabe[] = []): number {
  if (auslastung.length === 0) {
    return 0;
  }

  const latest = [...auslastung].sort((a, b) => Number(new Date(b.monat)) - Number(new Date(a.monat)))[0];
  return Number(latest?.verkaufte_speisen ?? 0);
}

function calculateIngredientKosten(item: RezeptZutatenEingabe): number {
  if (item.unterrezept) {
    const subRecipe = item.unterrezept;
    const subKosten = berechneSelbstkosten(subRecipe, { fixkosten: [], auslastung: [], ziel: { ziel_typ: 'db_quote', wert: 0 } });
    const portionFactor = subRecipe.portionsgroesse && subRecipe.portionsgroesse > 0 ? item.menge / subRecipe.portionsgroesse : item.menge;
    return subKosten * portionFactor;
  }

  if (!item.zutat) {
    return 0;
  }

  const einkaufspreis = Number(item.zutat.einkaufspreis_netto ?? 0);
  const einkaufsmenge = Number(item.zutat.einkaufsmenge ?? 0);
  const menge = Number(item.menge ?? 0);

  if (einkaufsmenge <= 0 || menge <= 0) {
    return 0;
  }

  const quot = (einkaufspreis / einkaufsmenge) * menge;
  const faktor =
    (1 - normalizePercent(item.verschnitt_pct)) *
    (1 - normalizePercent(item.garverlust_pct)) *
    (1 - normalizePercent(item.schwund_pct));

  if (faktor <= 0) {
    return 0;
  }

  return quot / faktor;
}

function calculatePersonalkosten(rezept: RezeptEingabe): number {
  const arbeitszeit = rezept.arbeitszeit ?? [];

  return arbeitszeit.reduce((sum, eintrag) => {
    const personalkategorie = eintrag.personalkategorie ?? { stundensatz_ag_gesamt: 0 };
    const batchGroesse = Number(eintrag.batch_groesse ?? 1);
    const gesamtMinuten =
      Number(eintrag.vorbereitung_min ?? 0) +
      Number(eintrag.produktion_min ?? 0) +
      Number(eintrag.anrichten_min ?? 0);

    if (batchGroesse <= 0) {
      return sum;
    }

    const kosten = (gesamtMinuten / 60) * Number(personalkategorie.stundensatz_ag_gesamt ?? 0) / batchGroesse;
    return sum + kosten;
  }, 0);
}

function berechneSelbstkosten(
  rezept: RezeptEingabe,
  config: Pick<KalkulationsInput, 'fixkosten' | 'auslastung' | 'ziel'>,
): number {
  const wareneinsatz = (rezept.zutaten ?? []).reduce((sum, zutat) => sum + calculateIngredientKosten(zutat), 0);
  const personalkosten = calculatePersonalkosten(rezept);
  const fixkosten = config.fixkosten ?? [];
  const estimated = getLatestPortions(config.auslastung ?? []);
  const fixkosten_anteil = fixedKostenTotal(fixkosten) / (estimated || 1);
  return wareneinsatz + personalkosten + fixkosten_anteil;
}

function fixedKostenTotal(fixkosten: FixkostenEingabe[] = []): number {
  return fixkosten.reduce((sum, eintrag) => sum + Number(eintrag.betrag_monat ?? 0), 0);
}

export function berechneKalkulation(input: KalkulationsInput): KalkulationsErgebnis {
  const fixkosten = input.fixkosten ?? [];
  const auslastung = input.auslastung ?? [];
  const verkaufskanale = input.verkaufskanale ?? [];
  const ziel = input.ziel;

  const wareneinsatz = (input.rezept.zutaten ?? []).reduce((sum, zutat) => sum + calculateIngredientKosten(zutat), 0);
  const personalkosten = calculatePersonalkosten(input.rezept);
  const estimatedPortions = getLatestPortions(auslastung);
  const fixkosten_anteil = fixedKostenTotal(fixkosten) / (estimatedPortions || 1);
  const selbstkosten = wareneinsatz + personalkosten + fixkosten_anteil;

  const je_kanal = verkaufskanale.map((kanal) => {
    const variablePct = normalizePercent(kanal.provision_pct) + normalizePercent(kanal.kartengebuehr_pct);
    const zielDbPct = normalizePercent(ziel.wert);
    const mindestPreisDenominator = 1 - variablePct;
    const empfohlenerPreisDenominator = 1 - zielDbPct - variablePct;

    if (mindestPreisDenominator <= 0) {
      throw new Error(`Der Mindestpreis für Kanal ${kanal.name ?? 'Unbekannt'} ist nicht berechenbar.`);
    }

    if (empfohlenerPreisDenominator <= 0) {
      throw new Error(`Der empfohlene Preis für Kanal ${kanal.name ?? 'Unbekannt'} ist nicht berechenbar.`);
    }

    const mindestpreis_netto = selbstkosten / mindestPreisDenominator;
    const empfohlener_preis_netto = selbstkosten / empfohlenerPreisDenominator;
    const steuersatz = normalizePercent(kanal.steuersatz?.satz_pct);
    const preis_brutto = empfohlener_preis_netto * (1 + steuersatz);
    const db = empfohlener_preis_netto - wareneinsatz - (empfohlener_preis_netto * variablePct);
    const db_quote = empfohlener_preis_netto > 0 ? db / empfohlener_preis_netto : 0;

    return {
      kanal,
      mindestpreis_netto,
      empfohlener_preis_netto,
      preis_brutto,
      db,
      db_quote,
    };
  });

  return {
    wareneinsatz,
    personalkosten,
    fixkosten_anteil,
    selbstkosten,
    je_kanal,
  };
}
