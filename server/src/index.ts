import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { initSocketServer } from './realtime/socket';
import { resumeActiveSimulations, stopAllSimulations } from './services/gps-simulator.service';
import { startLateTripChecker, stopLateTripChecker } from './services/late-trip-checker.service';
import {
  startRefreshTokenCleanup,
  stopRefreshTokenCleanup,
} from './services/refresh-token-cleanup.service';
import {
  startVehicleAlertChecker,
  stopVehicleAlertChecker,
} from './services/vehicle-alert-checker.service';

const app = createApp();
const httpServer = createServer(app);
const io = initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`API pornit pe http://localhost:${env.PORT}`);
});
startLateTripChecker();
startVehicleAlertChecker();
startRefreshTokenCleanup();
// TICK_MS=5s dă timp clienților abia reconectați să se alăture camerei firmei
// înainte de primul emit — nu e nevoie de o întârziere explicită de boot ca la ceilalți
resumeActiveSimulations().catch((err: unknown) => {
  logger.error({ err }, '[gps-simulator] eroare la resume-ul curselor în desfășurare');
});

// altfel conexiunile socket țin portul ocupat după SIGTERM (docker stop, restart tsx watch)
function shutdown(): void {
  stopLateTripChecker();
  stopVehicleAlertChecker();
  stopRefreshTokenCleanup();
  stopAllSimulations();
  io.close();
  httpServer.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
