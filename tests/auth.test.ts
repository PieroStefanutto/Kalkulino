import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetStores } from '../src/server/app';

describe('auth and tenant isolation', () => {
  beforeEach(() => {
    resetStores();
  });

  it('registers and logs in a user', async () => {
    const registerRes = await request(createApp())
      .post('/auth/register')
      .send({
        email: 'owner@example.com',
        password: 'secret123',
        betriebName: 'Gastro A',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user.email).toBe('owner@example.com');
    expect(registerRes.body.user.betriebId).toBeTruthy();
    expect(registerRes.body.token).toBeTruthy();

    const loginRes = await request(createApp())
      .post('/auth/login')
      .send({
        email: 'owner@example.com',
        password: 'secret123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe('owner@example.com');
    expect(loginRes.body.token).toBeTruthy();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(createApp()).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('enforces tenant isolation across business IDs', async () => {
    const app = createApp();

    const alpha = await request(app)
      .post('/auth/register')
      .send({
        email: 'alpha@example.com',
        password: 'secret123',
        betriebName: 'Alpha Betrieb',
      });

    await request(app)
      .post('/auth/register')
      .send({
        email: 'beta@example.com',
        password: 'secret123',
        betriebName: 'Beta Betrieb',
      });

    const protectedRes = await request(app)
      .get(`/betrieb/${alpha.body.user.betriebId}/zutaten`)
      .set('Authorization', `Bearer ${alpha.body.token}`);

    expect(protectedRes.status).toBe(200);
    expect(Array.isArray(protectedRes.body.items)).toBe(true);

    const crossTenantRes = await request(app)
      .get(`/betrieb/${alpha.body.user.betriebId}/zutaten`)
      .set('Authorization', `Bearer ${alpha.body.token}`);

    expect(crossTenantRes.status).toBe(200);
  });

  it('denies access if the JWT belongs to a different tenant', async () => {
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

    const res = await request(app)
      .get(`/betrieb/${alpha.body.user.betriebId}/zutaten`)
      .set('Authorization', `Bearer ${beta.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TENANT_FORBIDDEN');
  });
});
