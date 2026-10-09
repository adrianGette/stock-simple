# Stock Simple — guide for Claude

POS + inventory app for small shops (demo data: a skate shop called "Shop"). Portfolio project of Adrián Gette. UI, docs and code comments are in **Spanish (Rioplatense)**; git commit messages are in **English, imperative mood**.

- Live: web https://stock-simple-adrian.netlify.app · API https://stock-simple-api.onrender.com/api (Swagger at `/api/docs`)
- Repo: https://github.com/adrianGette/stock-simple · Deploy guide: `docs/DEPLOY.md` · Security: `SECURITY.md` · Decisions: `docs/adr/`

## Architecture

npm-workspaces monorepo:

- `packages/shared` — Zod schemas, DTO types and pure domain rules (`can()` permissions, `adjustAmount()` price rounding, money in **integer cents**, Spanish validation messages). Used by both apps; the API consumes the compiled CJS (`npm run build:shared`), the web imports the TS source through a Vite/tsconfig alias.
- `apps/api` — NestJS 12 + Prisma 7 (`prisma-client` generator → `src/generated`, adapter `pg`) + PostgreSQL 17. One module per domain: auth, users, categories, products, stock, sales, pricing, reports, health. Global guards: `AuthGuard` (JWT, re-reads the user every request; `@Public()` opts out) then `PermissionsGuard` (`@RequirePermissions(...)`). Bodies/queries validated with `ZodBody`/`ZodQuery` from shared schemas; errors normalized to `{ statusCode, code, message, details }` by `HttpExceptionFilter`; business errors via `AppError` with codes from `packages/shared/src/errors.ts`.
- `apps/web` — React 19 + Vite + React Router 7 + TanStack Query 5 + react-hook-form/zod. Feature folders in `src/features/<x>` (pages, `api.ts` hooks); shared UI in `src/shared/ui` (native `<dialog>`, popover toasts, custom SVG charts, no component library). CSS Modules + design tokens in `src/styles/tokens.css` (modern clean look: Geist font, slate grays, 1px borders, soft shadows, rounded corners, indigo accent with an indigo → violet gradient on primary actions and highlighted headings; sentence case everywhere, never uppercase UI text; light and dark themes).

## Key invariants (don't break these)

- Every business query filters by `businessId` (multi-tenant). Cashiers never receive `costCents` (DTO mappers strip it server-side).
- Sales are atomic: conditional `UPDATE … WHERE stock >= qty RETURNING`, rows locked in id order, per-business sale counter, `idempotencyKey` unique per business. Stock changes always write a `stock_movements` row.
- Auth: access JWT (15 min) in memory only; rotating refresh token in httpOnly cookie on `/api/auth` (hash stored, reuse → revoke family).
- `DEMO_MODE=true` (production) blocks creating/updating users (`DEMO_READ_ONLY`); `AuthUser.demoMode` tells the web.
- Web CSP lives in `netlify.toml` AND `apps/web/nginx/security-headers.conf`; it authorizes the inline theme script in `index.html` by sha256. `apps/web/src/security-headers.test.ts` fails if the hash or the two CSPs drift — update both when editing that script.

## Commands (repo root)

| Task | Command |
| --- | --- |
| Local DB only (dev) | `npm run db:up` (Docker; Postgres on 127.0.0.1:5433, also creates `stock_simple_test`) |
| First-time setup | `cp apps/api/.env.example apps/api/.env && npm run setup` |
| Dev servers | `npm run dev:api` (3000) · `npm run dev:web` (5173, proxies `/api`) |
| Full stack in Docker | `docker compose up --build` → http://localhost:8080 (services db → migrate → api → web) |
| Checks | `npm run lint` · `npm run typecheck` · `npm test` |
| E2E | `npm run test:api:e2e` (Vitest + Supertest, real Postgres test DB) · `npm run test:web:e2e` (Playwright; spins its own API on 3100 + web on 5174, reseeds the test DB) |
| Reseed demo | `npm run db:seed -w @stock/api` (wipes data; `SEED_ONLY_IF_EMPTY=true` skips if data exists) |

Gotchas: the Docker CLI on this Mac is at `/Applications/Docker.app/Contents/Resources/bin` (not on PATH) and Docker Desktop is often stopped after a reboot (`open -a Docker`). Prisma refuses `migrate reset` without explicit user consent — never bypass it. API tests run with Vitest + `unplugin-swc` (Nest 12 is ESM-only; Jest doesn't work).

## Deployment (all free tier, auto-deploy on push to `production`)

Git flow: never commit to `main` or `production` directly (rulesets enforce it). Each change goes in a `fix/…` or `feat/…` branch → PR to `main` (CI must pass). A release is a PR `main → production` merged with a merge commit (never squash); that is what deploys. `main` itself only gets a Netlify branch deploy (`main--stock-simple-adrian.netlify.app`): it serves the web from `main`, but its `/api` still proxies to the production API, so new endpoints only work there after a release (there is no staging API by design; test API changes locally). Netlify is on the Free (legacy) plan: 300 build minutes/month shared by every build (production, `main` branch deploy and PR previews, ~1 min each), 100 GB bandwidth, resets on the 1st. Releases don't need batching for cost.

Netlify (web, `netlify.toml`, proxies `/api/*` → Render so the session cookie is first-party) · Render (API, `render.yaml` Blueprint, region virginia, migrations on start) · Neon (Postgres, AWS us-east-1 — must stay in the same region as the API). GitHub Actions: `ci.yml` (lint/types/unit/e2e + Docker build smoke test) and `reset-demo.yml` (reseeds Neon nightly at 07:00 UTC, secret `DEMO_DATABASE_URL`). Secrets live only in Render/GitHub settings; never commit `.env` and never type credentials into forms on the user's behalf.
