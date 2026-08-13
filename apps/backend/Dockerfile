# ---------- Base ----------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------- Dependências (usa o lockfile do monorepo) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# ---------- Dev (hot-reload via docker-compose.dev.yml) ----------
FROM deps AS dev
# CMD vem do override do compose

# ---------- Build ----------
FROM deps AS build
COPY . .
RUN pnpm --filter @farmaubs/backend... build

# ---------- Runtime (produção) ----------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]