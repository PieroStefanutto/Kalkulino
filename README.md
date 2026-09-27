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

## Run locally

```bash
npm install
npm test
```

## Notes

This is intentionally a pure backend logic layer without any database calls or HTTP bindings, so it can be unit-tested in isolation exactly as required by the handoff.
