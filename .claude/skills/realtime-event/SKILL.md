---
name: realtime-event
description: Procedura standard pentru adăugarea unui eveniment Socket.io nou (server → client)
---

Pentru orice eveniment realtime nou, în ordinea asta:

1. Schema Zod + tip în `shared/src/schemas/realtime.ts`, exportat ca `<nume>EventSchema` / `<Nume>Event`
2. Adaugă evenimentul în `ServerToClientEvents` din `server/src/realtime/socket.ts` (server/src/realtime/socket.ts:7-10)
3. Emite DOAR prin `getIo().to(companyRoom(companyId)).emit('nume:eveniment', payload)` — niciodată `io.emit` global, altfel scapi izolarea multi-tenant
4. Emiterea trăiește în service-ul relevant (ex. trip.service, gps-simulator.service), nu în controller
5. Client: handler în `client/src/lib/socket.ts` sau hook dedicat (vezi `use-vehicle-position.ts` ca model) — cleanup pe `off()` la unmount
6. Pași de testare manuală: două tab-uri logate pe firme diferite → confirmă că evenimentul ajunge doar la firma corectă
