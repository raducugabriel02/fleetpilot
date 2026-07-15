import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Company, Prisma, User } from '@prisma/client';
import type { AuthUser, LoginInput, RegisterInput } from '@fleetpilot/shared';
import { env } from '../lib/env';
import { signAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';

const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

type UserWithCompany = User & { company: Company };

// În DB ținem doar hash-ul: dacă cineva citește tabelul, tot nu poate folosi token-urile
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function toAuthUser(user: UserWithCompany): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company.name,
  };
}

// fereastră în care reutilizarea unui token rotit e tratată ca retry legitim
// (două tab-uri, retry de rețea), nu ca furt de token
const REFRESH_REUSE_GRACE_MS = 30 * 1000;

// hash real, dar imposibil de potrivit: îl comparăm când emailul nu există,
// ca durata răspunsului să nu divulge ce conturi există
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

async function issueTokens(
  user: UserWithCompany,
  db: Prisma.TransactionClient = prisma,
): Promise<AuthTokens> {
  const rawToken = randomBytes(32).toString('base64url');
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: refreshExpiresAt },
  });
  return {
    accessToken: signAccessToken({ sub: user.id, companyId: user.companyId, role: user.role }),
    refreshToken: rawToken,
    refreshExpiresAt,
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, 'Există deja un cont cu acest email', 'EMAIL_TAKEN');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  // create imbricat = o singură tranzacție: nu rămânem cu firmă fără admin
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: 'ADMIN',
      company: { create: { name: input.companyName, cui: input.cui } },
    },
    include: { company: true },
  });
  return { user: toAuthUser(user), tokens: await issueTokens(user) };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { company: true },
  });
  // mesaj identic și durată identică pentru "user inexistent" și "parolă greșită" —
  // nu confirmăm ce email-uri există, nici prin text, nici prin timing
  const invalid = new HttpError(401, 'Email sau parolă greșită', 'INVALID_CREDENTIALS');
  const passwordOk = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !user.isActive || !passwordOk) throw invalid;
  return { user: toAuthUser(user), tokens: await issueTokens(user) };
}

export async function refresh(rawToken: string): Promise<AuthResult> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { include: { company: true } } },
  });
  const invalid = new HttpError(401, 'Sesiune expirată, autentifică-te din nou', 'INVALID_SESSION');
  if (!stored) throw invalid;
  if (stored.expiresAt < new Date() || !stored.user.isActive) throw invalid;
  if (stored.revokedAt) {
    const withinGrace = Date.now() - stored.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
    if (!withinGrace) {
      // token rotit demult și refolosit = posibil furat; invalidăm toate sesiunile
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw invalid;
    }
    // retry concurent legitim: emitem o pereche nouă fără să declanșăm alarma
    return { user: toAuthUser(stored.user), tokens: await issueTokens(stored.user) };
  }
  // revocare + emitere atomic: dacă emiterea eșuează, tokenul vechi rămâne valid
  const tokens = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return issueTokens(stored.user, tx);
  });
  return { user: toAuthUser(stored.user), tokens };
}

export async function logout(rawToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true },
  });
  if (!user || !user.isActive) {
    throw new HttpError(401, 'Cont inexistent sau dezactivat', 'UNAUTHENTICATED');
  }
  return toAuthUser(user);
}
