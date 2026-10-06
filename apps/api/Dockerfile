# syntax=docker/dockerfile:1
#
# Imagen de la API (NestJS), en etapas. Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile .
# Solo la etapa "runtime" llega a la imagen final: sin TypeScript, sin tests y sin
# herramientas de build.

# ---------- base: sistema común a todas las etapas ----------
FROM node:24-bookworm-slim AS base
# OpenSSL lo necesita el motor de migraciones de Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- deps: dependencias completas (incluye las de desarrollo) ----------
FROM base AS deps
# Primero solo los package.json: mientras no cambien, Docker reutiliza esta capa
# de la caché y no vuelve a instalar todo en cada build.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Solo los workspaces que necesita la API (la web tiene sus propias dependencias).
RUN npm ci --workspace @stock/shared --workspace @stock/api --include-workspace-root

# ---------- build: compila TypeScript ----------
# Esta etapa también la usa el servicio "migrate" de docker-compose, que necesita
# el CLI de Prisma y tsx para aplicar migraciones y cargar la demo.
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @stock/shared \
  && npm run build -w @stock/api

# ---------- runtime: la imagen final, liviana ----------
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
# Instalar solo lo que la API necesita para correr. Dos trampas del monorepo:
#  1. npm instala todos los workspaces del lockfile, así que se quita la web de la lista.
#  2. --omit=dev no alcanza: el CLI de Prisma y TypeScript siguen instalados porque otros
#     paquetes los declaran como dependencias "par" opcionales, y arrastran ~250 MB
#     (Prisma Studio, React…). Se desinstalan explícitamente.
# `npm install` respeta las versiones fijadas en package-lock.json.
RUN node -e "const p=require('./package.json');p.workspaces=['packages/shared','apps/api'];require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))" \
  && npm install --omit=dev --no-audit --no-fund \
  && npm uninstall prisma typescript --workspace @stock/api --omit=dev --no-audit --no-fund \
  && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist

# Nunca correr como root: si alguien lograra ejecutar código en el contenedor,
# no tendría privilegios de administrador. La imagen de Node trae el usuario "node".
USER node
WORKDIR /app/apps/api
EXPOSE 3000

# Docker considera el contenedor "sano" solo si /api/health responde (incluye la base).
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
