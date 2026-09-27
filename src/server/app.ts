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

const stores = {
  betriebe: new Map<string, BetriebRecord>(),
  users: new Map<string, UserRecord>(),
  usersByEmail: new Map<string, string>(),
  resources: new Map<string, TenantResource[]>(),
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

export function resetStores(): void {
  stores.betriebe.clear();
  stores.users.clear();
  stores.usersByEmail.clear();
  stores.resources.clear();
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
    const items = stores.resources.get(betriebId) ?? [];
    const tenantItems = filterByTenant(items, req.user!.betriebId);

    return res.json({
      items: tenantItems,
    });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
  });

  return app;
}
