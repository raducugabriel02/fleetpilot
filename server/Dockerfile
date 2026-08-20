# build context = rădăcina monorepo-ului (npm workspaces: server depinde de @fleetpilot/shared)

FROM node:20-alpine AS deps
WORKDIR /app
# bcrypt e nativ (node-gyp); alpine (musl) nu are mereu prebuild — instrumentele de
# compilare garantează că npm ci reușește indiferent, chiar dacă nu vine binar prefabricat
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
# npm ci instalează toate workspace-urile (nu doar server) — npm nu suportă instalare
# parțială curată într-un monorepo cu un singur package-lock.json; acceptabil pt. un
# proiect mic. tsx e dependency (rulează aplicația în producție, fără pas de compilare
# separat — vezi tsconfig noEmit), prisma rămâne devDependency, necesar doar la generate
RUN npm ci

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared shared
COPY server server
# WORKDIR = server: aici stă prisma.config.ts, descoperit automat de CLI (schema și
# comanda de seed sunt relative la el) — node tot găsește /app/node_modules urcând
# în arborele de directoare, deci npx/tsx rezolvă normal din /app/server
WORKDIR /app/server
# prisma generate doar parsează schema (nu se conectează) dar tot cere DATABASE_URL
# rezolvabil — valoare fictivă doar pt. build; la rulare, docker-compose o suprascrie
# cu adresa reală a bazei de date
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma generate

EXPOSE 4000
# /api/health verifică și conexiunea la DB (SELECT 1) — util ca alte servicii
# (client/Caddy) să aștepte un backend chiar funcțional, nu doar procesul pornit
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# migrate deploy rulează la fiecare pornire a containerului — idempotent (sare peste
# migrațiile deja aplicate), simplu și suficient pt. o singură instanță de server;
# un deploy cu mai multe replici ar avea nevoie de un job de migrare separat
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
