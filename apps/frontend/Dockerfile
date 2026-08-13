# ---------- Base ----------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------- Dependências ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# ---------- Dev (Vite dev server via docker-compose.dev.yml) ----------
FROM deps AS dev
# CMD vem do override do compose

# ---------- Build estático ----------
FROM deps AS build
COPY . .
RUN pnpm --filter @farmaubs/frontend build

# ---------- Runtime (produção): estáticos servidos por Nginx ----------
FROM nginx:alpine AS runtime
COPY infra/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]