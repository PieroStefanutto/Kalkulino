import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetStores } from '../src/server/app';

describe('betrieb configuration and kalkulation endpoint', () => {
  beforeEach(() => {
    resetStores();
  });

  it('creates fix costs, sales data and computes a per-channel recommendation', async () => {
    const app = createApp();

    const userRes = await request(app)
      .post('/auth/register')
      .send({
        email: 'operator@example.com',
        password: 'secret123',
        betriebName: 'Betrieb C',
      });

    const token = userRes.body.token;

    const ingredientRes = await request(app)
      .post('/zutaten')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Mozzarella',
        einkaufsmenge: 1,
        einkaufspreis_netto: 8,
        einheit: 'kg',
      });

    const recipeRes = await request(app)
      .post('/rezepte')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lasagne', portionsgroesse: 2 });

    await request(app)
      .post(`/rezepte/${recipeRes.body.recipe.id}/zutaten`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        zutatId: ingredientRes.body.ingredient.id,
        menge: 0.5,
      });

    const fixkostenRes = await request(app)
      .post('/fixkosten')
      .set('Authorization', `Bearer ${token}`)
      .send({ kategorie: 'Miete', betrag_monat: 1200 });

    const auslastungRes = await request(app)
      .post('/auslastung')
      .set('Authorization', `Bearer ${token}`)
      .send({ monat: '2026-09-01', verkaufte_speisen: 100 });

    const steuersatzRes = await request(app)
      .post('/steuersaetze')
      .set('Authorization', `Bearer ${token}`)
      .send({ bezeichnung: 'vor Ort', satz_pct: 19 });

    const kanalRes = await request(app)
      .post('/verkaufskanaele')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Restaurant',
        provision_pct: 8,
        kartengebuehr_pct: 2,
        steuersatz_id: steuersatzRes.body.item.id,
      });

    await request(app)
      .put('/ziel')
      .set('Authorization', `Bearer ${token}`)
      .send({ ziel_typ: 'db_quote', wert: 30 });

    const calcRes = await request(app)
      .get(`/rezepte/${recipeRes.body.recipe.id}/kalkulation`)
      .set('Authorization', `Bearer ${token}`);

    expect(calcRes.status).toBe(200);
    expect(calcRes.body.kalkulation.wareneinsatz).toBeGreaterThan(0);
    expect(calcRes.body.kalkulation.je_kanal).toHaveLength(1);
    expect(calcRes.body.kalkulation.je_kanal[0].kanal.name).toBe('Restaurant');
    expect(calcRes.body.kalkulation.je_kanal[0].empfohlener_preis_netto).toBeGreaterThan(0);
  });

  it('stores tenant values and prevents cross-tenant leakage', async () => {
    const app = createApp();

    const alpha = await request(app)
      .post('/auth/register')
      .send({
        email: 'alpha@example.com',
        password: 'secret123',
        betriebName: 'Alpha Betrieb',
      });

    const beta = await request(app)
      .post('/auth/register')
      .send({
        email: 'beta@example.com',
        password: 'secret123',
        betriebName: 'Beta Betrieb',
      });

    await request(app)
      .post('/fixkosten')
      .set('Authorization', `Bearer ${alpha.body.token}`)
      .send({ kategorie: 'Miete', betrag_monat: 900 });

    const betaList = await request(app)
      .get('/fixkosten')
      .set('Authorization', `Bearer ${beta.body.token}`);

    expect(betaList.status).toBe(200);
    expect(betaList.body.items).toEqual([]);
  });
});
