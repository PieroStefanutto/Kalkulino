import { describe, expect, it } from 'vitest';
import { berechneKalkulation } from '../src/core/pricing';

describe('berechneKalkulation', () => {
  it('berechnet ein Rezept ohne Unterrezept korrekt', () => {
    const rezept = {
      id: 'r-1',
      name: 'Pizza Margherita',
      portionsgroesse: 1,
      zutaten: [
        {
          menge: 0.5,
          zutat: {
            einkaufspreis_netto: 2,
            einkaufsmenge: 1,
          },
          verschnitt_pct: 0,
          garverlust_pct: 0,
          schwund_pct: 0,
        },
        {
          menge: 0.25,
          zutat: {
            einkaufspreis_netto: 4,
            einkaufsmenge: 1,
          },
          verschnitt_pct: 0,
          garverlust_pct: 0,
          schwund_pct: 0,
        },
      ],
      arbeitszeit: [
        {
          vorbereitung_min: 10,
          produktion_min: 20,
          anrichten_min: 5,
          batch_groesse: 1,
          personalkategorie: { stundensatz_ag_gesamt: 30 },
        },
      ],
    };

    const result = berechneKalkulation({
      rezept,
      fixkosten: [{ betrag_monat: 2000 }],
      auslastung: [{ monat: '2026-09-01', verkaufte_speisen: 1000 }],
      verkaufskanale: [{
        id: 'k-1',
        name: 'Restaurant',
        provision_pct: 0.08,
        kartengebuehr_pct: 0.02,
        steuersatz: { satz_pct: 0.19 },
      }],
      ziel: { ziel_typ: 'db_quote', wert: 0.28 },
    });

    expect(result.wareneinsatz).toBeCloseTo(2, 10);
    expect(result.personalkosten).toBeCloseTo(17.5, 10);
    expect(result.fixkosten_anteil).toBeCloseTo(2, 10);
    expect(result.selbstkosten).toBeCloseTo(21.5, 10);
    expect(result.je_kanal[0].empfohlener_preis_netto).toBeCloseTo(21.5 / (1 - 0.28 - 0.1), 10);
  });

  it('berechnet ein Rezept mit einer Ebene Unterrezept korrekt', () => {
    const unterrezept = {
      id: 'r-unter',
      name: 'Tomatensoße',
      portionsgroesse: 2,
      zutaten: [
        {
          menge: 1,
          zutat: {
            einkaufspreis_netto: 12,
            einkaufsmenge: 2,
          },
          verschnitt_pct: 0,
          garverlust_pct: 0,
          schwund_pct: 0,
        },
      ],
      arbeitszeit: [],
    };

    const rezept = {
      id: 'r-2',
      name: 'Pasta',
      portionsgroesse: 1,
      zutaten: [
        {
          menge: 0.5,
          unterrezept,
          verschnitt_pct: 0,
          garverlust_pct: 0,
          schwund_pct: 0,
        },
      ],
      arbeitszeit: [],
    };

    const result = berechneKalkulation({
      rezept,
      fixkosten: [],
      auslastung: [{ monat: '2026-09-01', verkaufte_speisen: 50 }],
      verkaufskanale: [{
        id: 'k-1',
        name: 'Restaurant',
        provision_pct: 0.1,
        kartengebuehr_pct: 0.02,
        steuersatz: { satz_pct: 0.19 },
      }],
      ziel: { ziel_typ: 'db_quote', wert: 0.25 },
    });

    expect(result.wareneinsatz).toBeCloseTo(1.5, 10);
  });

  it('verwendet die korrekte prozentuale Rückwärtsrechnung bei hoher Provision', () => {
    const rezept = {
      id: 'r-3',
      name: 'High-Commission Dish',
      portionsgroesse: 1,
      zutaten: [
        {
          menge: 1,
          zutat: {
            einkaufspreis_netto: 12,
            einkaufsmenge: 1,
          },
          verschnitt_pct: 0,
          garverlust_pct: 0,
          schwund_pct: 0,
        },
      ],
      arbeitszeit: [],
    };

    const result = berechneKalkulation({
      rezept,
      fixkosten: [],
      auslastung: [{ monat: '2026-09-01', verkaufte_speisen: 100 }],
      verkaufskanale: [{
        id: 'k-1',
        name: 'Delivery',
        provision_pct: 0.3,
        kartengebuehr_pct: 0.05,
        steuersatz: { satz_pct: 0.19 },
      }],
      ziel: { ziel_typ: 'db_quote', wert: 0.35 },
    });

    const kanal = result.je_kanal[0];
    const selfKosten = result.selbstkosten;
    const expected = selfKosten / (1 - 0.35 - 0.35);

    expect(kanal.empfohlener_preis_netto).toBeCloseTo(expected, 12);
    expect(kanal.empfohlener_preis_netto).not.toBeCloseTo(selfKosten * (1 + 0.35 + 0.35), 12);
  });
});
