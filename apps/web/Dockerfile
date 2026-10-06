# syntax=docker/dockerfile:1
#
# Imagen de la web: compila React y la sirve con nginx. Se construye desde la raíz:
#   docker build -f apps/web/Dockerfile .
# La imagen final no lleva Node: solo nginx y los archivos estáticos.

# ---------- build: compila la web ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --ignore-scripts: la web no necesita compilar dependencias nativas de la API
# (argon2, motores de Prisma), y no ejecutar scripts de terceros es más seguro.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @stock/web

# ---------- runtime: nginx sin privilegios de root ----------
# La variante "unprivileged" corre como el usuario nginx y escucha en el puerto 8080.
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY apps/web/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
# 127.0.0.1 y no "localhost": en Alpine, localhost resuelve primero a ::1 (IPv6)
# y nginx escucha en IPv4, así que el chequeo fallaría aunque la web funcione.
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
