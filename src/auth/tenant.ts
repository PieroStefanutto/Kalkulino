import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  betriebId: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export function signToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      betriebId: user.betriebId,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '12h' },
  );
}

export function verifyToken(token: string): AuthenticatedUser {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & {
    userId?: string;
    email?: string;
    betriebId?: string;
    role?: string;
  };

  if (!decoded.userId || !decoded.email || !decoded.betriebId) {
    throw new Error('Invalid token payload');
  }

  return {
    userId: decoded.userId,
    email: decoded.email,
    betriebId: decoded.betriebId,
    role: decoded.role ?? 'owner',
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header missing or malformed.',
      },
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'The provided token is invalid or expired.',
      },
    });
  }
}

export function requireTenantAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const requestedBetriebId = req.params.betriebId;

  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required before a tenant can be checked.',
      },
    });
    return;
  }

  if (!requestedBetriebId || req.user.betriebId !== requestedBetriebId) {
    res.status(403).json({
      error: {
        code: 'TENANT_FORBIDDEN',
        message: 'This user is not allowed to access this tenant context.',
      },
    });
    return;
  }

  next();
}

export function filterByTenant<T extends { betriebId: string }>(items: T[], tenantId: string): T[] {
  return items.filter((item) => item.betriebId === tenantId);
}
