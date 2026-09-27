import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetStores } from '../src/server/app';

describe('personalkategorien and recipe working time', () => {
  beforeEach(() => {
    resetStores();
  });

  it('stores labor categories and recipe work times for the tenant', async () => {
    const app = createApp();

    const auth = await request(app)
      .post('/auth/register')
      .send({
        email: 'staff@example.com',
        password: 'secret123',
        betriebName: 'Labor Co',
      });

    const token = auth.body.token;

    const categoryRes = await request(app)
      .post('/personalkategorien')
      .set('Authorization', `Bearer ${token}`)
      .send({ bezeichnung: 'Koch', stundensatz_ag_gesamt: 24.5 });

    expect(categoryRes.status).toBe(201);
    expect(categoryRes.body.item.bezeichnung).toBe('Koch');

    const recipeRes = await request(app)
      .post('/rezepte')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tagliatelle', portionsgroesse: 1 });

    const laborRes = await request(app)
      .post(`/rezepte/${recipeRes.body.recipe.id}/arbeitszeit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        personalkategorie_id: categoryRes.body.item.id,
        vorbereitung_min: 10,
        produktion_min: 15,
        anrichten_min: 5,
        batch_groesse: 2,
      });

    expect(laborRes.status).toBe(201);
    expect(laborRes.body.item.personalkategorie_id).toBe(categoryRes.body.item.id);

    const detailRes = await request(app)
      .get(`/rezepte/${recipeRes.body.recipe.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.recipe.arbeitszeit).toHaveLength(1);
  });

  it('keeps labor data isolated per tenant', async () => {
    const app = createApp();

    const alpha = await request(app)
      .post('/auth/register')
      .send({
        email: 'alpha@example.com',
        password: 'secret123',
        betriebName: 'Alpha Küche',
      });

    const beta = await request(app)
      .post('/auth/register')
      .send({
        email: 'beta@example.com',
        password: 'secret123',
        betriebName: 'Beta Küche',
      });

    await request(app)
      .post('/personalkategorien')
      .set('Authorization', `Bearer ${alpha.body.token}`)
      .send({ bezeichnung: 'Souschef', stundensatz_ag_gesamt: 30 });

    const betaList = await request(app)
      .get('/personalkategorien')
      .set('Authorization', `Bearer ${beta.body.token}`);

    expect(betaList.status).toBe(200);
    expect(betaList.body.items).toEqual([]);
  });
});
