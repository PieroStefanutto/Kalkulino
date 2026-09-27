# Kalkulino

Minimal TypeScript foundation for the gastro pricing MVP described in the handoff.

## What is included

- Pure pricing engine in `src/core/pricing.ts`
- Regression tests for the required calculation cases in `tests/pricing.test.ts`
- Export entry point in `src/index.ts`

## Calculation logic

The MVP pricing function implements the requested pure business-logic flow:

- ingredient cost calculation with waste, trimming and shrinkage
- recursive subrecipe support
- labor cost calculation from preparation/production/finishing minutes
- fixed-cost allocation from the latest monthly sales volume
- per-channel price calculation with target DB quote and additional sales fees

## Auth and tenant isolation

Step 2 from the handoff is implemented as a minimal backend layer for authentication and business-bound authorization:

- `POST /auth/register` creates a tenant and a user
- `POST /auth/login` issues a JWT for the user
- `GET /auth/me` returns the authenticated session user
- `GET /betrieb/:betriebId/zutaten` is protected by `requireAuth` and `requireTenantAccess`
- tenant filtering is enforced server-side with a strict business-ID check before returning data

This follows the requirement that no query may trust the client to decide the tenant scope. The server checks the JWT session and denies access if the business context does not match.

## Run locally

```bash
npm install
npm test
```

## Notes

The project now includes both the pure backend pricing logic and the auth/tenant layer needed for the MVP foundation.
