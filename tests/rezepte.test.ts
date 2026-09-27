import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetStores } from '../src/server/app';

describe('recipe CRUD and subrecipe linkage', () => {
  beforeEach(() => {
    resetStores();
  });

  it('creates a recipe, links ingredients and stores a subrecipe relation', async () => {
    const app = createApp();

    const userRes = await request(app)
      .post('/auth/register')
      .send({
        email: 'cook@example.com',
        password: 'secret123',
        betriebName: 'Gastro B',
      });

    const token = userRes.body.token;

    const zutatRes = await request(app)
      .post('/zutaten')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Tomate',
        einkaufsmenge: 1,
        einkaufspreis_netto: 3,
        einheit: 'kg',
      });

    const baseRecipeRes = await request(app)
      .post('/rezepte')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Tomatenbasis',
        portionsgroesse: 2,
      });

    const recipeRes = await request(app)
      .post('/rezepte')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Pizza',
        portionsgroesse: 1,
      });

    const relationRes = await request(app)
      .post(`/rezepte/${recipeRes.body.recipe.id}/zutaten`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        zutatId: zutatRes.body.ingredient.id,
        menge: 0.5,
        verschnitt_pct: 10,
        garverlust_pct: 5,
        schwund_pct: 3,
      });

    expect(relationRes.status).toBe(201);
    expect(relationRes.body.line.zutatId).toBe(zutatRes.body.ingredient.id);

    const subLinkRes = await request(app)
      .post(`/rezepte/${recipeRes.body.recipe.id}/zutaten`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        unterrezeptId: baseRecipeRes.body.recipe.id,
        menge: 0.25,
      });

    expect(subLinkRes.status).toBe(201);
    expect(subLinkRes.body.line.unterrezeptId).toBe(baseRecipeRes.body.recipe.id);

    const detailRes = await request(app)
      .get(`/rezepte/${recipeRes.body.recipe.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.recipe.ingredients).toHaveLength(2);
  });

  it('keeps recipe data isolated per tenant', async () => {
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

    const alphaRecipe = await request(app)
      .post('/rezepte')
      .set('Authorization', `Bearer ${alpha.body.token}`)
      .send({ name: 'Alpha Gericht', portionsgroesse: 1 });

    const betaList = await request(app)
      .get('/rezepte')
      .set('Authorization', `Bearer ${beta.body.token}`);

    expect(betaList.status).toBe(200);
    expect(betaList.body.items.some((item: { id: string }) => item.id === alphaRecipe.body.recipe.id)).toBe(false);
  });
});
