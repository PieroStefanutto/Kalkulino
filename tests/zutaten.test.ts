import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetStores } from '../src/server/app';

describe('ingredient CRUD and price history', () => {
  beforeEach(() => {
    resetStores();
  });

  it('creates, lists, updates and deletes ingredients for the logged-in tenant', async () => {
    const app = createApp();

    const registerRes = await request(app)
      .post('/auth/register')
      .send({
        email: 'chef@example.com',
        password: 'secret123',
        betriebName: 'Bistro One',
      });

    const token = registerRes.body.token;

    const createRes = await request(app)
      .post('/zutaten')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Tomaten',
        einkaufsmenge: 10,
        einkaufspreis_netto: 12,
        einheit: 'kg',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.ingredient.name).toBe('Tomaten');

    const listRes = await request(app)
      .get('/zutaten')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(3);

    const ingredientId = createRes.body.ingredient.id;

    const updateRes = await request(app)
      .put(`/zutaten/${ingredientId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        einkaufspreis_netto: 15,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.ingredient.einkaufspreis_netto).toBe(15);

    const historyRes = await request(app)
      .get(`/zutaten/${ingredientId}/preishistorie`)
      .set('Authorization', `Bearer ${token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.history).toHaveLength(2);

    const deleteRes = await request(app)
      .delete(`/zutaten/${ingredientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);
  });

  it('does not expose another tenant\'s ingredients', async () => {
    const app = createApp();

    const alpha = await request(app)
      .post('/auth/register')
      .send({
        email: 'alpha@example.com',
        password: 'secret123',
        betriebName: 'Alpha',
      });

    const beta = await request(app)
      .post('/auth/register')
      .send({
        email: 'beta@example.com',
        password: 'secret123',
        betriebName: 'Beta',
      });

    const alphaIngredient = await request(app)
      .post('/zutaten')
      .set('Authorization', `Bearer ${alpha.body.token}`)
      .send({
        name: 'Mozzarella',
        einkaufsmenge: 1,
        einkaufspreis_netto: 4,
        einheit: 'kg',
      });

    const betaList = await request(app)
      .get('/zutaten')
      .set('Authorization', `Bearer ${beta.body.token}`);

    expect(betaList.status).toBe(200);
    expect(betaList.body.items.some((item: { id: string }) => item.id === alphaIngredient.body.ingredient.id)).toBe(false);
  });
});
