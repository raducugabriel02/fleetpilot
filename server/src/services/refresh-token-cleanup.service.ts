import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
// mai generos decât fereastra de grație la reutilizare din auth.service.ts (30s) — nu e
// nevoie să fie exact, doar sigur peste ea, ca să nu ștergem un token revocat chiar
// înainte ca un retry legitim (dublu tab, retry de rețea) să mai poată trece prin el
const REVOKED_RETENTION_MS = 5 * 60 * 1000;

async function cleanupExpiredRefreshTokens(): Promise<void> {
  const now = new Date();
  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { lt: new Date(now.getTime() - REVOKED_RETENTION_MS) } },
      ],
    },
  });
  if (count > 0) {
    logger.info({ count }, '[refresh-token-cleanup] token-uri expirate/revocate șterse');
  }
}

let timer: NodeJS.Timeout | null = null;

function runCleanup(): void {
  cleanupExpiredRefreshTokens().catch((err: unknown) => {
    logger.error({ err }, '[refresh-token-cleanup] eroare la curățare');
  });
}

export function startRefreshTokenCleanup(): void {
  if (timer) return;
  // rulează și la boot (spre deosebire de vehicle-alert-checker, nu depinde de clienți
  // reconectați la un socket — nicio grabă de evitat), apoi o dată pe zi
  runCleanup();
  timer = setInterval(runCleanup, CHECK_INTERVAL_MS);
}

export function stopRefreshTokenCleanup(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
