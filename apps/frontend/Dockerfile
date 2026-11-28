# ---------- Base ----------
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app

# ---------- Dependências ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# ---------- Dev (Vite dev server via docker-compose.dev.yml) ----------
FROM deps AS dev
# CMD vem do override do compose

# ---------- Build estático (shared + frontend) ----------
FROM deps AS build
ARG VITE_API_URL=/api/v1
ARG VITE_SHOW_FUTURE_MODULES=false
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SHOW_FUTURE_MODULES=${VITE_SHOW_FUTURE_MODULES}
COPY . .
RUN pnpm --filter @farmaubs/frontend... build

# ---------- Runtime (produção): estáticos servidos por Nginx ----------
FROM nginx:alpine AS runtime
COPY infra/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
