import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './lib/env';
import { initSocketServer } from './realtime/socket';
import { stopAllSimulations } from './services/gps-simulator.service';
import { startLateTripChecker, stopLateTripChecker } from './services/late-trip-checker.service';
import {
  startVehicleAlertChecker,
  stopVehicleAlertChecker,
} from './services/vehicle-alert-checker.service';

const app = createApp();
const httpServer = createServer(app);
const io = initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`API pornit pe http://localhost:${env.PORT}`);
});
startLateTripChecker();
startVehicleAlertChecker();

// altfel conexiunile socket țin portul ocupat după SIGTERM (docker stop, restart tsx watch)
function shutdown(): void {
  stopLateTripChecker();
  stopVehicleAlertChecker();
  stopAllSimulations();
  io.close();
  httpServer.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
