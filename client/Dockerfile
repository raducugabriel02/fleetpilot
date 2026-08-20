# build context = rădăcina monorepo-ului (npm workspaces: client depinde de @fleetpilot/shared)

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY shared shared
COPY client client
RUN npm run build -w client

# Caddy servește static + face reverse proxy către server pe același domeniu (necesar
# pentru cookie-ul de refresh, sameSite=lax) — și obține automat certificat HTTPS
# (Let's Encrypt) dacă DOMAIN e un nume de domeniu real, fără configurare suplimentară
FROM caddy:2-alpine AS runner
COPY client/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/client/dist /srv
EXPOSE 80 443
