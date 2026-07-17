---
name: new-endpoint
description: Procedura standard pentru adăugarea unui endpoint nou în API
---

Pentru orice endpoint nou, în ordinea asta:

1. Schema Zod în shared/schemas/ (refolosită de client și server)
2. Service cu logica de business (primește companyId, îl aplică în TOATE query-urile)
3. Controller subțire: parse Zod → apel service → răspuns
4. Ruta în routes/ cu middleware de auth + rol
5. Hook TanStack Query în client/src/api/
6. Pașii de testare manuală (curl sau UI)
