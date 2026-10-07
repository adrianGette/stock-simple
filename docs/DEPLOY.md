# Publicar Stock Simple gratis

Tres servicios con plan gratuito, sin tarjeta de crédito:

| Pieza | Servicio | Qué tener en cuenta |
| --- | --- | --- |
| Base de datos | [Neon](https://neon.com) | 1 GB por proyecto. No vence. Se "duerme" sin uso y despierta en segundos. |
| API (NestJS) | [Render](https://render.com) | 750 h/mes. Se duerme tras 15 min sin tráfico; el primer pedido tarda 30–60 s en despertarla. |
| Web (React) | [Netlify](https://netlify.com) | 300 créditos/mes: cada deploy consume 15 (unos 20 deploys por mes) y las visitas casi nada. Si se agotan, el sitio se pausa hasta el mes siguiente; nunca cobra. |

La web ya contempla que la API esté dormida: apenas se abre, la despierta con `/api/health`, muestra un aviso ("Despertando el servidor…") y reintenta sola las lecturas.

```
Navegador ──► Netlify (web + proxy /api/*) ──► Render (API) ──► Neon (Postgres)
```

Netlify reenvía `/api/*` a Render. Para el navegador todo es el mismo sitio, así que la cookie de sesión es first-party ([ADR 0004](adr/0004-sesion-con-refresh-token-en-cookie.md)).

---

## 1. Subir el código a GitHub

Render y Netlify despliegan desde un repositorio.

1. Creá una cuenta en [github.com](https://github.com) si no tenés, y un repositorio **vacío** llamado `stock-simple` (sin README ni .gitignore).
2. En la carpeta del proyecto:

```bash
git init -b main
git add .
git commit -m "Stock Simple: primera versión"
git remote add origin https://github.com/TU_USUARIO/stock-simple.git
git push -u origin main
```

Los secretos no se suben: `.env` está en `.gitignore`.

## 2. Base de datos en Neon

1. Creá una cuenta en [neon.com](https://neon.com) (podés entrar con GitHub) y un proyecto llamado `stock-simple`, región **AWS US East 1 (N. Virginia)**. Tiene que ser la misma región que la API en Render (`region: virginia` en `render.yaml`), porque cada pedido hace varias consultas a la base. Render no tiene región en Sudamérica.
2. En **Connect**, desactivá **Connection pooling** y copiá la connection string. Tiene esta forma:
   `postgresql://usuario:clave@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
   Usá la conexión **directa** (sin `-pooler` en el host): las migraciones de Prisma la necesitan.
3. Desde tu máquina, creá las tablas y cargá los datos de demo:

```bash
DATABASE_URL="PEGÁ_ACÁ_LA_URL_DE_NEON" npm run db:deploy -w @stock/api
```
```bash
DATABASE_URL="PEGÁ_ACÁ_LA_URL_DE_NEON" npm run db:seed -w @stock/api
```

⚠️ El seed **borra todo** lo que haya en esa base antes de cargar la demo. Usalo solo al principio, o cuando quieras resetear la demo.

## 3. API en Render

1. Creá una cuenta en [render.com](https://render.com) con tu GitHub.
2. **New → Blueprint** y elegí el repositorio. Render lee `render.yaml` y crea el servicio `stock-simple-api`.
3. Te va a pedir dos variables:
   - `DATABASE_URL`: la URL de Neon del paso 2.
   - `WEB_ORIGIN`: la URL que te va a dar Netlify, por ejemplo `https://stock-simple.netlify.app`. Si todavía no la sabés, poné cualquier valor y corregilo después en **Environment**.
4. Esperá a que el deploy termine y probá `https://stock-simple-api.onrender.com/api/health`. Tiene que responder `{"status":"ok"}`.

Si el nombre `stock-simple-api` ya estaba tomado, Render te asigna otra URL: anotala para el paso siguiente.

## 4. Web en Netlify

1. Si tu URL de Render es distinta de `https://stock-simple-api.onrender.com`, cambiala en `netlify.toml`, hacé commit y push:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://TU-API.onrender.com/api/:splat"
```

2. Creá una cuenta en [netlify.com](https://netlify.com) con tu GitHub → **Add new site → Import an existing project** → elegí el repositorio. Netlify lee `netlify.toml`: no hay que configurar nada más.
3. En **Site configuration → Change site name** elegí un nombre, por ejemplo `stock-simple` (la URL queda `https://stock-simple.netlify.app`).
4. Volvé a Render y verificá que `WEB_ORIGIN` sea exactamente esa URL (sin barra final).

## 5. Probar

Entrá a tu URL de Netlify. La primera vez puede aparecer "Despertando el servidor…" durante un minuto; después ingresá con los botones de la demo (contraseña `demo1234`).

---

## 6. Releases: deployar cuando vos decidas

Los dos servicios publican **solo** la rama `production`. `main` es la rama de trabajo: ahí se mergean los PRs (con el CI en verde) sin tocar lo publicado.

| Rama | Para qué | Qué se publica |
| --- | --- | --- |
| `main` | Cada cambio entra por PR | Copia de prueba en `https://main--TU-SITIO.netlify.app` (gratis) |
| `production` | Lo que ve la gente | El sitio público y la API de Render |

**Para hacer un release:** en GitHub, **Pull requests → New pull request**, base `production` ← compare `main`. Título `Release AAAA-MM-DD`. Cuando el CI esté en verde, **Create a merge commit** (nunca squash: si no, las ramas se separan y el próximo release trae conflictos). Netlify y Render deployan solos. El historial de releases queda en los PRs mergeados a `production`.

Configuración (una sola vez):

1. GitHub: creá la rama `production` desde `main`. En **Settings → Rules → Rulesets** protegé `main` y `production`: PR obligatorio, checks *Lint, tipos y tests* e *Imágenes Docker* en verde, sin force push ni borrado; en `production`, solo merge commit.
2. Netlify: **Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts**. Production branch `production`; Branch deploys: solo `main`; Deploy Previews: activados (son gratis, igual que los branch deploys).
3. Render: en el Blueprint y en el servicio (**Settings → Build & Deploy → Branch**) elegí `production`. `render.yaml` ya lo indica con `branch: production`.

## Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| El deploy de Render falla en `prisma` o `nest` | El build tiene que instalar las devDependencies: verificá que el build command tenga `npm ci --include=dev`. |
| `Variables de entorno inválidas` en el log de Render | Falta `DATABASE_URL` o `WEB_ORIGIN`, o tienen un formato inválido. |
| Login correcto, pero al recargar te saca | `WEB_ORIGIN` no coincide con la URL de Netlify, o el proxy de `netlify.toml` apunta a otra URL. |
| `Demasiados intentos` | El rate limit de login es de 5 por minuto por IP. Si aparece con poco uso, revisá `TRUST_PROXY_HOPS=2`. |
| El sitio muestra "Site not available" | Se terminaron los créditos del mes de Netlify (sobre todo por deploys). Vuelve el mes siguiente. |

## Mantenerlo gratis

- Solo los releases (merge a `production`) consumen créditos de Netlify: 15 cada uno. Agrupá varios PRs por release (por ejemplo, uno por semana) y quedás muy lejos del límite. Los branch deploys, deploy previews y deploys fallidos no consumen.
- No uses la base de Postgres de Render: se borra a los 30 días.
- Para resetear la demo, volvé a correr el seed contra Neon (paso 2).
