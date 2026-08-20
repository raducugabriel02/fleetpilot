import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { createDriver, addAbsence } from '../src/services/driver.service';
import { createVehicle } from '../src/services/vehicle.service';
import { createClient } from '../src/services/client.service';
import { createTrip, assignTrip, cancelTrip } from '../src/services/trip.service';

/*
 * Date demo realiste, pentru portofoliu: o firmă mică de transport, cu flotă/șoferi/clienți
 * și curse în toate statusurile (istoric, în curs, planificate, de dispecerizat, anulate).
 * Idempotent: rulat de mai multe ori, șterge firma anterioară (cascade) și o reconstruiește
 * identic — nu se acumulează duplicate la re-seed.
 */

const SEED_CUI = 'RO18547693';
const SEED_PASSWORD = 'Parola123!';

// firma operează în România; folosim offset-ul de vară (EEST, UTC+3) — datele de mai jos
// sunt toate în august/septembrie 2026, în perioada de oră de vară
function ro(iso: string): Date {
  return new Date(`${iso}+03:00`);
}

// escaladare directă de status pentru curse istorice/în desfășurare: trip.service.startTrip
// și .completeTrip declanșează simulatorul GPS și emit-uri Socket.io, ambele indisponibile
// într-un script standalone (fără server HTTP pornit) — aici scriem direct starea finală deja
// validată de assignTrip (capacitate/conflicte/absențe), fără să reluăm efectele live
async function forceTripProgress(
  tripId: string,
  vehicleId: string,
  status: 'IN_PROGRESS' | 'COMPLETED',
  startedAt: Date,
  completedAt?: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id: tripId },
      data: { status, startedAt, completedAt: completedAt ?? null },
    });
    if (status === 'IN_PROGRESS') {
      await tx.vehicle.update({ where: { id: vehicleId }, data: { status: 'ON_TRIP' } });
    }
  });
}

async function main(): Promise<void> {
  const existing = await prisma.company.findUnique({ where: { cui: SEED_CUI } });
  if (existing) {
    // cascade: users, vehicles, drivers, clients, trips, agent actions — toate pe firma asta
    await prisma.company.delete({ where: { id: existing.id } });
    console.log(`Firmă demo anterioară ștearsă (${existing.id})`);
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const company = await prisma.company.create({
    data: {
      name: 'Transport Rapid Oltenia SRL',
      cui: SEED_CUI,
      users: {
        create: [
          {
            email: 'admin@transportrapid.ro',
            passwordHash,
            name: 'Andrei Marinescu',
            role: 'ADMIN',
          },
          {
            email: 'dispecer@transportrapid.ro',
            passwordHash,
            name: 'Elena Dumitrescu',
            role: 'DISPATCHER',
          },
        ],
      },
    },
    include: { users: true },
  });
  const companyId = company.id;
  const dispatcherId = company.users.find((u) => u.role === 'DISPATCHER')!.id;
  console.log(`Firmă creată: ${company.name} (${companyId})`);

  const [mihai, gheorghe, vasile, costel, nicolae] = await Promise.all([
    createDriver(companyId, {
      name: 'Mihai Constantin',
      email: 'mihai.constantin@transportrapid.ro',
      password: SEED_PASSWORD,
      phone: '0722100001',
      licenseCategories: ['B', 'C', 'CE'],
      licenseExpiresAt: ro('2028-04-15T00:00:00'),
    }),
    createDriver(companyId, {
      name: 'Gheorghe Stan',
      email: 'gheorghe.stan@transportrapid.ro',
      password: SEED_PASSWORD,
      phone: '0722100002',
      licenseCategories: ['C', 'CE'],
      licenseExpiresAt: ro('2027-11-20T00:00:00'),
    }),
    createDriver(companyId, {
      name: 'Vasile Radu',
      email: 'vasile.radu@transportrapid.ro',
      password: SEED_PASSWORD,
      phone: '0722100003',
      licenseCategories: ['B', 'C'],
      licenseExpiresAt: ro('2027-06-30T00:00:00'),
    }),
    createDriver(companyId, {
      name: 'Costel Barbu',
      email: 'costel.barbu@transportrapid.ro',
      password: SEED_PASSWORD,
      phone: '0722100004',
      licenseCategories: ['B', 'C', 'CE'],
      licenseExpiresAt: ro('2028-01-10T00:00:00'),
    }),
    createDriver(companyId, {
      name: 'Nicolae Enache',
      email: 'nicolae.enache@transportrapid.ro',
      password: SEED_PASSWORD,
      phone: '0722100005',
      licenseCategories: ['C', 'CE'],
      licenseExpiresAt: ro('2027-09-05T00:00:00'),
    }),
  ]);
  await addAbsence(companyId, nicolae.id, {
    type: 'VACATION',
    startsAt: '2026-08-25',
    endsAt: '2026-08-29',
    note: 'Concediu anual',
  });
  console.log(`5 șoferi creați, 1 absență programată (${nicolae.name})`);

  // CT08TRO nu e folosit în nicio cursă din seed — rămâne intenționat vehicul de rezervă
  const [dj12tro, dj45tro, , b102tro, tm77tro, ag19tro] = await Promise.all([
    createVehicle(companyId, {
      plateNumber: 'DJ12TRO',
      type: 'TRUCK',
      capacityTons: 7.5,
      capacityPallets: 18,
      itpExpiresAt: ro('2027-04-10T00:00:00'),
      rcaExpiresAt: ro('2027-02-20T00:00:00'),
      vignetteExpiresAt: ro('2026-08-24T00:00:00'), // expiră în 8 zile — alertă "curând"
    }),
    createVehicle(companyId, {
      plateNumber: 'DJ45TRO',
      type: 'SEMI',
      capacityTons: 24,
      capacityPallets: 33,
      itpExpiresAt: ro('2026-08-21T00:00:00'), // expiră în 5 zile — alertă "curând"
      rcaExpiresAt: ro('2027-01-15T00:00:00'),
      vignetteExpiresAt: ro('2027-01-01T00:00:00'),
    }),
    createVehicle(companyId, {
      plateNumber: 'CT08TRO',
      type: 'VAN',
      capacityTons: 3.5,
      capacityPallets: 8,
      itpExpiresAt: ro('2027-05-12T00:00:00'),
      rcaExpiresAt: ro('2027-03-30T00:00:00'),
      vignetteExpiresAt: ro('2027-02-01T00:00:00'),
    }),
    createVehicle(companyId, {
      plateNumber: 'B102TRO',
      type: 'TRUCK',
      capacityTons: 12,
      capacityPallets: 22,
      itpExpiresAt: ro('2026-11-15T00:00:00'),
      rcaExpiresAt: ro('2026-08-02T00:00:00'), // expirat de 14 zile — alertă "expirat"
      vignetteExpiresAt: ro('2027-01-20T00:00:00'),
    }),
    createVehicle(companyId, {
      plateNumber: 'TM77TRO',
      type: 'SEMI',
      capacityTons: 24,
      capacityPallets: 33,
      itpExpiresAt: ro('2027-06-01T00:00:00'),
      rcaExpiresAt: ro('2027-05-01T00:00:00'),
      vignetteExpiresAt: ro('2027-04-01T00:00:00'),
    }),
    createVehicle(companyId, {
      plateNumber: 'AG19TRO',
      type: 'VAN',
      capacityTons: 3.5,
      capacityPallets: 8,
      itpExpiresAt: ro('2027-03-01T00:00:00'),
      rcaExpiresAt: ro('2027-02-01T00:00:00'),
      vignetteExpiresAt: ro('2027-01-01T00:00:00'),
    }),
  ]);
  // B102TRO e în service chiar acum — dar tot poate fi PLANIFICAT în avans (vezi Trip D)
  await prisma.vehicle.update({ where: { id: b102tro.id }, data: { status: 'IN_SERVICE' } });
  console.log(
    '6 vehicule create (1 cu RCA expirat, 1 ITP curând, 1 rovinietă curând, 1 în service)',
  );

  const [agrofrig, metalurgica, freshLogistics, construMat, panificatieNord] = await Promise.all([
    createClient(companyId, {
      name: 'Agrofrig SRL',
      contactName: 'Radu Ionescu',
      phone: '0730100001',
      email: 'comenzi@agrofrig.ro',
      address: 'Str. Frigoriferului 4, Oltenița',
    }),
    createClient(companyId, {
      name: 'Metalurgica Sud SA',
      contactName: 'Cristina Popa',
      phone: '0730100002',
      email: 'logistica@metalurgicasud.ro',
      address: 'Bd. Industriilor 21, Reșița',
    }),
    createClient(companyId, {
      name: 'FreshLogistics Distribuție SRL',
      contactName: 'Bogdan Neagu',
      phone: '0730100003',
      email: 'transport@freshlogistics.ro',
      address: 'Calea Torontalului 118, Timișoara',
    }),
    createClient(companyId, {
      name: 'ConstruMat Prod SRL',
      contactName: 'Daniela Voicu',
      phone: '0730100004',
      email: 'aprovizionare@construmat.ro',
      address: 'Șos. de Centură 7, București',
    }),
    createClient(companyId, {
      name: 'Panificație Nord SRL',
      contactName: 'Ovidiu Matei',
      phone: '0730100005',
      email: 'comenzi@panificatienord.ro',
      address: 'Str. Morii 12, Iași',
    }),
  ]);
  console.log('5 clienți creați');

  console.log('Creez cursele (geocodare Nominatim + rutare OSRM, best-effort, poate dura ~30s)...');

  // A — COMPLETED, la timp
  const tripA = await createTrip(companyId, dispatcherId, {
    clientId: agrofrig.id,
    originAddress: 'Craiova',
    destAddress: 'Constanța',
    cargoDescription: 'Paleți produse congelate',
    pallets: 12,
    windowStart: ro('2026-08-05T08:00:00'),
    windowEnd: ro('2026-08-05T18:00:00'),
  });
  await assignTrip(companyId, tripA.id, { vehicleId: dj12tro.id, driverId: mihai.id });
  await forceTripProgress(
    tripA.id,
    dj12tro.id,
    'COMPLETED',
    ro('2026-08-05T08:10:00'),
    ro('2026-08-05T17:40:00'),
  );

  // B — COMPLETED, cu întârziere
  const tripB = await createTrip(companyId, dispatcherId, {
    clientId: metalurgica.id,
    originAddress: 'Reșița',
    destAddress: 'Ploiești',
    cargoDescription: 'Piese metalice paletizate',
    weightTons: 9.2,
    windowStart: ro('2026-08-10T07:00:00'),
    windowEnd: ro('2026-08-10T15:00:00'),
  });
  await assignTrip(companyId, tripB.id, { vehicleId: dj45tro.id, driverId: gheorghe.id });
  await forceTripProgress(
    tripB.id,
    dj45tro.id,
    'COMPLETED',
    ro('2026-08-10T07:05:00'),
    ro('2026-08-10T16:30:00'),
  );

  // C — IN_PROGRESS, azi
  const tripC = await createTrip(companyId, dispatcherId, {
    clientId: freshLogistics.id,
    originAddress: 'Timișoara',
    destAddress: 'Cluj-Napoca',
    cargoDescription: 'Produse lactate refrigerate',
    pallets: 14,
    windowStart: ro('2026-08-16T08:00:00'),
    windowEnd: ro('2026-08-16T16:00:00'),
  });
  await assignTrip(companyId, tripC.id, { vehicleId: tm77tro.id, driverId: vasile.id });
  await forceTripProgress(tripC.id, tm77tro.id, 'IN_PROGRESS', ro('2026-08-16T08:15:00'));

  // D — PLANNED (vehicul azi în service, dar disponibil până la data cursei)
  const tripD = await createTrip(companyId, dispatcherId, {
    clientId: construMat.id,
    originAddress: 'București',
    destAddress: 'Brașov',
    cargoDescription: 'Materiale de construcții paletizate',
    pallets: 20,
    windowStart: ro('2026-08-20T08:00:00'),
    windowEnd: ro('2026-08-20T20:00:00'),
  });
  await assignTrip(companyId, tripD.id, { vehicleId: b102tro.id, driverId: costel.id });

  // E — PLANNED (după concediul lui Nicolae)
  const tripE = await createTrip(companyId, dispatcherId, {
    clientId: panificatieNord.id,
    originAddress: 'Iași',
    destAddress: 'Suceava',
    cargoDescription: 'Făină și cereale în saci paletizați',
    pallets: 6,
    windowStart: ro('2026-09-02T07:00:00'),
    windowEnd: ro('2026-09-02T19:00:00'),
  });
  await assignTrip(companyId, tripE.id, { vehicleId: ag19tro.id, driverId: nicolae.id });

  // F, G — REQUEST, de dispecerizat
  await createTrip(companyId, dispatcherId, {
    clientId: agrofrig.id,
    originAddress: 'Oltenița',
    destAddress: 'Constanța',
    cargoDescription: 'Paleți legume proaspete',
    pallets: 6,
    windowStart: ro('2026-08-22T09:00:00'),
    windowEnd: ro('2026-08-22T15:00:00'),
  });
  await createTrip(companyId, dispatcherId, {
    clientId: freshLogistics.id,
    originAddress: 'Cluj-Napoca',
    destAddress: 'Oradea',
    cargoDescription: 'Produse congelate',
    pallets: 10,
    windowStart: ro('2026-08-25T08:00:00'),
    windowEnd: ro('2026-08-25T18:00:00'),
  });

  // H — CANCELLED
  const tripH = await createTrip(companyId, dispatcherId, {
    clientId: metalurgica.id,
    originAddress: 'Deva',
    destAddress: 'Arad',
    cargoDescription: 'Utilaje industriale',
    weightTons: 15,
    windowStart: ro('2026-08-14T08:00:00'),
    windowEnd: ro('2026-08-14T18:00:00'),
  });
  await cancelTrip(companyId, tripH.id);

  console.log(
    '8 curse create (2 finalizate, 1 în desfășurare, 2 planificate, 2 de dispecerizat, 1 anulată)',
  );

  console.log('\nSeed complet. Autentificare (parolă comună pt. toate conturile demo):');
  console.log(`  parolă: ${SEED_PASSWORD}`);
  console.log('  admin@transportrapid.ro       (ADMIN)');
  console.log('  dispecer@transportrapid.ro     (DISPATCHER)');
  console.log('  mihai.constantin@transportrapid.ro (DRIVER)');
  console.log('  gheorghe.stan@transportrapid.ro    (DRIVER)');
  console.log('  vasile.radu@transportrapid.ro      (DRIVER)');
  console.log('  costel.barbu@transportrapid.ro     (DRIVER)');
  console.log('  nicolae.enache@transportrapid.ro   (DRIVER)');
}

main()
  .catch((err: unknown) => {
    console.error('Seed eșuat:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
