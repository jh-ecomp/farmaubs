# ---------- Base ----------
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app

# ---------- Dependências (usa o lockfile do monorepo) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# ---------- Dev (hot-reload via docker-compose.dev.yml) ----------
FROM deps AS dev
# CMD vem do override do compose

# ---------- Build + pacote isolado de produção ----------
FROM deps AS build
COPY . .
RUN pnpm --filter @farmaubs/backend... build \
  && pnpm --filter=@farmaubs/backend --prod deploy --legacy /prod/backend \
  && rm -rf /prod/backend/node_modules/@farmaubs/shared \
  && mkdir -p /prod/backend/node_modules/@farmaubs/shared \
  && cp -r /app/packages/shared/package.json /app/packages/shared/dist /prod/backend/node_modules/@farmaubs/shared/ \
  && test -f /prod/backend/dist/main.js \
  && test -f /prod/backend/dist/database/data-source.js \
  && test -f /prod/backend/dist/database/bootstrap-prod.js \
  && test -f /prod/backend/dist/database/seed-qa.js \
  && test ! -L /prod/backend/node_modules/@farmaubs/shared \
  && test -f /prod/backend/node_modules/@farmaubs/shared/dist/index.js \
  && test ! -d /prod/backend/node_modules/jest

# ---------- Runtime (produção enxuta, sem root e sem devDependencies) ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache tzdata
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo

WORKDIR /app/apps/backend
COPY --from=build --chown=node:node /prod/backend ./
RUN mkdir -p ./storage/reports && chown -R node:node ./storage

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
