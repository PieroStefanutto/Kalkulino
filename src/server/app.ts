import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  filterByTenant,
  requireAuth,
  requireTenantAccess,
  signToken,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from '../auth/tenant';

export interface BetriebRecord {
  id: string;
  name: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  betriebId: string;
  role: string;
}

export interface TenantResource {
  id: string;
  name: string;
  betriebId: string;
}

export interface ZutatRecord {
  id: string;
  betriebId: string;
  name: string;
  einkaufsmenge: number;
  einkaufspreis_netto: number;
  einheit: string;
  lieferantId?: string | null;
  aktualisiert_am: string;
}

export interface PreisHistorieRecord {
  id: string;
  zutatId: string;
  betriebId: string;
  preis: number;
  datum: string;
  quelle: string;
}

export interface RezeptRecord {
  id: string;
  betriebId: string;
  name: string;
  portionsgroesse: number;
  ist_unterrezept: boolean;
  verkaufspreis_netto?: number | null;
  aktualisiert_am: string;
}

export interface RezeptZutatRecord {
  id: string;
  betriebId: string;
  rezeptId: string;
  zutatId?: string | null;
  unterrezeptId?: string | null;
  menge: number;
  verschnitt_pct: number;
  garverlust_pct: number;
  schwund_pct: number;
}

const stores = {
  betriebe: new Map<string, BetriebRecord>(),
  users: new Map<string, UserRecord>(),
  usersByEmail: new Map<string, string>(),
  resources: new Map<string, TenantResource[]>(),
  zutaten: new Map<string, ZutatRecord[]>(),
  preishistorie: new Map<string, PreisHistorieRecord[]>(),
  rezepte: new Map<string, RezeptRecord[]>(),
  rezeptZutaten: new Map<string, RezeptZutatRecord[]>(),
};

const createId = () => crypto.randomUUID();

function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    betriebId: user.betriebId,
    role: user.role,
  };
}

function buildUserJwt(user: UserRecord): AuthenticatedUser {
  return {
    userId: user.id,
    email: user.email,
    betriebId: user.betriebId,
    role: user.role,
  };
}

function errorResponse(res: Response, status: number, code: string, message: string) {
  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function getTenantZutaten(betriebId: string): ZutatRecord[] {
  return stores.zutaten.get(betriebId) ?? [];
}

function getTenantPriceHistory(betriebId: string, zutatId: string): PreisHistorieRecord[] {
  const all = stores.preishistorie.get(betriebId) ?? [];
  return all.filter((entry) => entry.zutatId === zutatId);
}

function getTenantRezepte(betriebId: string): RezeptRecord[] {
  return stores.rezepte.get(betriebId) ?? [];
}

function getRecipeLines(rezeptId: string, betriebId: string): RezeptZutatRecord[] {
  return (stores.rezeptZutaten.get(betriebId) ?? []).filter((line) => line.rezeptId === rezeptId);
}

function addPriceHistory(betriebId: string, zutatId: string, preis: number): PreisHistorieRecord[] {
  const existing = stores.preishistorie.get(betriebId) ?? [];
  const history = [
    ...existing,
    {
      id: createId(),
      zutatId,
      betriebId,
      preis,
      datum: new Date().toISOString().slice(0, 10),
      quelle: 'manuell',
    },
  ];

  stores.preishistorie.set(betriebId, history);
  return history;
}

export function resetStores(): void {
  stores.betriebe.clear();
  stores.users.clear();
  stores.usersByEmail.clear();
  stores.resources.clear();
  stores.zutaten.clear();
  stores.preishistorie.clear();
  stores.rezepte.clear();
  stores.rezeptZutaten.clear();
}

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;

    if (!user) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'The user is not authenticated.');
    }

    const currentUser = stores.users.get(user.userId);

    if (!currentUser) {
      return errorResponse(res, 404, 'USER_NOT_FOUND', 'The current user could not be found.');
    }

    return res.json({ user: sanitizeUser(currentUser) });
  });

  app.post('/auth/register', async (req: Request, res: Response) => {
    const { email, password, betriebName } = req.body ?? {};

    if (!email || !password) {
      return errorResponse(res, 400, 'INVALID_INPUT', 'Email and password are required.');
    }

    const normalizedEmail = String(email).toLowerCase();

    if (stores.usersByEmail.has(normalizedEmail)) {
      return errorResponse(res, 409, 'EMAIL_EXISTS', 'A user with this email already exists.');
    }

    const betriebId = createId();
    const betrieb: BetriebRecord = {
      id: betriebId,
      name: String(betriebName || 'Neues Unternehmen'),
    };

    stores.betriebe.set(betriebId, betrieb);
    stores.resources.set(betriebId, [
      { id: createId(), name: 'Tomaten', betriebId },
      { id: createId(), name: 'Pasta', betriebId },
    ]);

    const seededIngredients: ZutatRecord[] = [
      {
        id: createId(),
        betriebId,
        name: 'Tomaten',
        einkaufsmenge: 1,
        einkaufspreis_netto: 1.8,
        einheit: 'kg',
        aktualisiert_am: new Date().toISOString(),
      },
      {
        id: createId(),
        betriebId,
        name: 'Pasta',
        einkaufsmenge: 1,
        einkaufspreis_netto: 2.4,
        einheit: 'kg',
        aktualisiert_am: new Date().toISOString(),
      },
    ];

    stores.zutaten.set(betriebId, seededIngredients);
    stores.preishistorie.set(
      betriebId,
      seededIngredients.map((ingredient) => ({
        id: createId(),
        zutatId: ingredient.id,
        betriebId,
        preis: ingredient.einkaufspreis_netto,
        datum: new Date().toISOString().slice(0, 10),
        quelle: 'manuell',
      })),
    );

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user: UserRecord = {
      id: createId(),
      email: normalizedEmail,
      passwordHash,
      betriebId,
      role: 'owner',
    };

    stores.users.set(user.id, user);
    stores.usersByEmail.set(user.email, user.id);

    const token = signToken(buildUserJwt(user));

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  });

  app.post('/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return errorResponse(res, 400, 'INVALID_INPUT', 'Email and password are required.');
    }

    const normalizedEmail = String(email).toLowerCase();
    const userId = stores.usersByEmail.get(normalizedEmail);

    if (!userId) {
      return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'The supplied credentials are invalid.');
    }

    const user = stores.users.get(userId);

    if (!user) {
      return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'The supplied credentials are invalid.');
    }

    const passwordMatches = await bcrypt.compare(String(password), user.passwordHash);

    if (!passwordMatches) {
      return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'The supplied credentials are invalid.');
    }

    const token = signToken(buildUserJwt(user));

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  });

  app.get('/betrieb/:betriebId/zutaten', requireAuth, requireTenantAccess, (req: AuthenticatedRequest, res: Response) => {
    const betriebId = Array.isArray(req.params.betriebId) ? req.params.betriebId[0] : req.params.betriebId;
    const items = getTenantZutaten(betriebId);
    const tenantItems = filterByTenant(items as Array<{ betriebId: string }>, req.user!.betriebId);

    return res.json({
      items: tenantItems,
    });
  });

  app.get('/zutaten', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const items = getTenantZutaten(req.user!.betriebId);
    return res.json({ items });
  });

  app.get('/rezepte', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const items = getTenantRezepte(req.user!.betriebId);
    return res.json({ items });
  });

  app.get('/rezepte/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rezeptId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const recipe = getTenantRezepte(req.user!.betriebId).find((item) => item.id === rezeptId);

    if (!recipe) {
      return errorResponse(res, 404, 'REZEPT_NOT_FOUND', 'The requested recipe was not found for this tenant.');
    }

    const ingredients = getRecipeLines(rezeptId, req.user!.betriebId);

    return res.json({ recipe: { ...recipe, ingredients } });
  });

  app.post('/rezepte', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { name, portionsgroesse, ist_unterrezept, verkaufspreis_netto } = req.body ?? {};

    if (!name) {
      return errorResponse(res, 400, 'INVALID_INPUT', 'Recipe name is required.');
    }

    const recipe: RezeptRecord = {
      id: createId(),
      betriebId: req.user!.betriebId,
      name: String(name),
      portionsgroesse: Number(portionsgroesse ?? 1),
      ist_unterrezept: Boolean(ist_unterrezept),
      verkaufspreis_netto: verkaufspreis_netto === undefined ? null : Number(verkaufspreis_netto),
      aktualisiert_am: new Date().toISOString(),
    };

    const tenantRecipes = getTenantRezepte(req.user!.betriebId);
    stores.rezepte.set(req.user!.betriebId, [...tenantRecipes, recipe]);

    return res.status(201).json({ recipe });
  });

  app.put('/rezepte/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rezeptId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const current = getTenantRezepte(req.user!.betriebId).find((item) => item.id === rezeptId);

    if (!current) {
      return errorResponse(res, 404, 'REZEPT_NOT_FOUND', 'The requested recipe was not found for this tenant.');
    }

    const updated: RezeptRecord = {
      ...current,
      ...req.body,
      id: current.id,
      betriebId: req.user!.betriebId,
      aktualisiert_am: new Date().toISOString(),
    };

    stores.rezepte.set(
      req.user!.betriebId,
      getTenantRezepte(req.user!.betriebId).map((item) => (item.id === current.id ? updated : item)),
    );

    return res.json({ recipe: updated });
  });

  app.delete('/rezepte/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rezeptId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tenantRecipes = getTenantRezepte(req.user!.betriebId);
    const recipe = tenantRecipes.find((item) => item.id === rezeptId);

    if (!recipe) {
      return errorResponse(res, 404, 'REZEPT_NOT_FOUND', 'The requested recipe was not found for this tenant.');
    }

    stores.rezepte.set(
      req.user!.betriebId,
      tenantRecipes.filter((item) => item.id !== rezeptId),
    );

    const recipeLines = stores.rezeptZutaten.get(req.user!.betriebId) ?? [];
    stores.rezeptZutaten.set(
      req.user!.betriebId,
      recipeLines.filter((line) => line.rezeptId !== rezeptId),
    );

    return res.json({ deleted: true, recipeId: rezeptId });
  });

  app.post('/rezepte/:id/zutaten', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rezeptId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const recipe = getTenantRezepte(req.user!.betriebId).find((item) => item.id === rezeptId);

    if (!recipe) {
      return errorResponse(res, 404, 'REZEPT_NOT_FOUND', 'The requested recipe was not found for this tenant.');
    }

    const { zutatId, unterrezeptId, menge, verschnitt_pct, garverlust_pct, schwund_pct } = req.body ?? {};

    if (!zutatId && !unterrezeptId) {
      return errorResponse(res, 400, 'INVALID_INPUT', 'A ingredient or subrecipe reference is required.');
    }

    const line: RezeptZutatRecord = {
      id: createId(),
      betriebId: req.user!.betriebId,
      rezeptId,
      zutatId: zutatId ?? null,
      unterrezeptId: unterrezeptId ?? null,
      menge: Number(menge ?? 0),
      verschnitt_pct: Number(verschnitt_pct ?? 0),
      garverlust_pct: Number(garverlust_pct ?? 0),
      schwund_pct: Number(schwund_pct ?? 0),
    };

    const existing = stores.rezeptZutaten.get(req.user!.betriebId) ?? [];
    stores.rezeptZutaten.set(req.user!.betriebId, [...existing, line]);

    return res.status(201).json({ line });
  });

  app.put('/rezepte/:id/zutaten/:zid', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rezeptId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const zutatId = Array.isArray(req.params.zid) ? req.params.zid[0] : req.params.zid;
    const recipe = getTenantRezepte(req.user!.betriebId).find((item) => item.id === rezeptId);

    if (!recipe) {
      return errorResponse(res, 404, 'REZEPT_NOT_FOUND', 'The requested recipe was not found for this tenant.');
    }

    const lines = (stores.rezeptZutaten.get(req.user!.betriebId) ?? []).map((line) => {
      if (line.id === zutatId && line.rezeptId === rezeptId) {
        return {
          ...line,
          ...req.body,
          id: line.id,
          betriebId: req.user!.betriebId,
          rezeptId,
        };
      }

      return line;
    });

    const target = lines.find((line) => line.id === zutatId && line.rezeptId === rezeptId);

    if (!target) {
      return errorResponse(res, 404, 'REZEPT_ZUTAT_NOT_FOUND', 'The requested recipe ingredient entry was not found.');
    }

    stores.rezeptZutaten.set(req.user!.betriebId, lines);
    return res.json({ line: target });
  });

  app.delete('/rezepte/:id/zutaten/:zid', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rezeptId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const zutatId = Array.isArray(req.params.zid) ? req.params.zid[0] : req.params.zid;
    const recipe = getTenantRezepte(req.user!.betriebId).find((item) => item.id === rezeptId);

    if (!recipe) {
      return errorResponse(res, 404, 'REZEPT_NOT_FOUND', 'The requested recipe was not found for this tenant.');
    }

    const lines = (stores.rezeptZutaten.get(req.user!.betriebId) ?? []).filter(
      (line) => !(line.id === zutatId && line.rezeptId === rezeptId),
    );

    stores.rezeptZutaten.set(req.user!.betriebId, lines);
    return res.json({ deleted: true, lineId: zutatId });
  });

  app.get('/zutaten/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const zutatId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ingredient = getTenantZutaten(req.user!.betriebId).find((item) => item.id === zutatId);

    if (!ingredient) {
      return errorResponse(res, 404, 'ZUTAT_NOT_FOUND', 'The requested ingredient was not found for this tenant.');
    }

    return res.json({ item: ingredient });
  });

  app.post('/zutaten', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { name, einkaufsmenge, einkaufspreis_netto, einheit, lieferantId } = req.body ?? {};

    if (!name || !einkaufsmenge || !einkaufspreis_netto || !einheit) {
      return errorResponse(res, 400, 'INVALID_INPUT', 'Name, quantity, buy price and unit are required.');
    }

    const item: ZutatRecord = {
      id: createId(),
      betriebId: req.user!.betriebId,
      name: String(name),
      einkaufsmenge: Number(einkaufsmenge),
      einkaufspreis_netto: Number(einkaufspreis_netto),
      einheit: String(einheit),
      lieferantId: lieferantId ? String(lieferantId) : null,
      aktualisiert_am: new Date().toISOString(),
    };

    const tenantItems = getTenantZutaten(req.user!.betriebId);
    const nextItems = [...tenantItems, item];
    stores.zutaten.set(req.user!.betriebId, nextItems);
    const history = addPriceHistory(req.user!.betriebId, item.id, item.einkaufspreis_netto);

    return res.status(201).json({ ingredient: item, history });
  });

  app.put('/zutaten/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const zutatId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const current = getTenantZutaten(req.user!.betriebId).find((item) => item.id === zutatId);

    if (!current) {
      return errorResponse(res, 404, 'ZUTAT_NOT_FOUND', 'The requested ingredient was not found for this tenant.');
    }

    const nextItem: ZutatRecord = {
      ...current,
      ...req.body,
      id: current.id,
      betriebId: req.user!.betriebId,
      aktualisiert_am: new Date().toISOString(),
    };

    const updatedItems = getTenantZutaten(req.user!.betriebId).map((item) => item.id === current.id ? nextItem : item);
    stores.zutaten.set(req.user!.betriebId, updatedItems);

    if (req.body.einkaufspreis_netto !== undefined && Number(req.body.einkaufspreis_netto) !== current.einkaufspreis_netto) {
      addPriceHistory(req.user!.betriebId, current.id, Number(req.body.einkaufspreis_netto));
    }

    return res.json({ ingredient: nextItem });
  });

  app.delete('/zutaten/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const zutatId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tenantItems = getTenantZutaten(req.user!.betriebId);
    const ingredient = tenantItems.find((item) => item.id === zutatId);

    if (!ingredient) {
      return errorResponse(res, 404, 'ZUTAT_NOT_FOUND', 'The requested ingredient was not found for this tenant.');
    }

    stores.zutaten.set(
      req.user!.betriebId,
      tenantItems.filter((item) => item.id !== zutatId),
    );

    const history = stores.preishistorie.get(req.user!.betriebId) ?? [];
    stores.preishistorie.set(
      req.user!.betriebId,
      history.filter((entry) => entry.zutatId !== zutatId),
    );

    return res.json({ deleted: true, ingredientId: zutatId });
  });

  app.get('/zutaten/:id/preishistorie', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const zutatId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ingredient = getTenantZutaten(req.user!.betriebId).find((item) => item.id === zutatId);

    if (!ingredient) {
      return errorResponse(res, 404, 'ZUTAT_NOT_FOUND', 'The requested ingredient was not found for this tenant.');
    }

    const history = getTenantPriceHistory(req.user!.betriebId, zutatId);
    return res.json({ history });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
  });

  return app;
}
