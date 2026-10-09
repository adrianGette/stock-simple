# Seguridad

Resumen de cómo está protegida Stock Simple y qué riesgos se aceptaron conscientemente.

## Autenticación y sesión

- **Contraseñas** con argon2id. El login responde igual y tarda lo mismo si el email no existe (no revela qué cuentas hay).
- **Access token** JWT de 15 minutos, solo en memoria del navegador (no en `localStorage`). El algoritmo de firma está fijo en HS256: la API rechaza tokens con cualquier otro.
- **Refresh token** opaco en cookie `HttpOnly; Secure; SameSite=Lax`, limitada a `/api/auth`. En la base se guarda solo su hash. Rota en cada uso y, si se reutiliza uno viejo, se revoca toda la familia de sesiones ([ADR 0004](docs/adr/0004-sesion-con-refresh-token-en-cookie.md)).
- Desactivar un usuario o cambiarle la contraseña cierra sus sesiones al instante: la API relee el usuario en cada request.
- **Rate limiting:** 5 intentos de login por minuto por IP y 300 requests por minuto en general.
- **Límite por cuenta:** 10 intentos fallidos en 15 minutos bloquean esa cuenta hasta que termine la ventana, aunque los intentos vengan de IPs distintas. Se cuenta igual exista o no el email, para no revelar qué cuentas hay. En la demo no se aplica (ver "Demo pública").
- **Proxy firmado:** Netlify firma cada pedido que reenvía a la API (encabezado `x-nf-sign`, HS256) y la API rechaza los que no traen una firma válida, salvo el health check y Swagger. Así nadie le pega directo a Render con una IP inventada para esquivar el rate limit. Se activa con la variable `PROXY_SIGNATURE_SECRET` en los dos servicios ([guía](docs/DEPLOY.md)).

## Autorización

- Toda ruta exige sesión salvo login, refresh, logout y health. Los permisos por rol se aplican **en el servidor** ([ADR 0005](docs/adr/0005-permisos-por-rol-en-un-solo-lugar.md)): un cajero no recibe costos en ninguna respuesta.
- **Multi-tenant:** cada consulta filtra por el comercio del usuario. Un test e2e verifica que un comercio no puede leer ni vender productos de otro.

## Entradas y datos

- Todo body y query se valida con esquemas Zod. Los campos desconocidos se descartan, así que no hay asignación masiva de campos.
- SQL: Prisma y consultas crudas con parámetros (`$queryRaw` con template tags). Nunca se concatenan datos del usuario.
- La web no inserta HTML crudo; React escapa todo el contenido.
- Paginación acotada (máximo 100) y body limitado a 100 KB.

## Cabeceras

- **API:** Helmet (CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`) y CORS restringido al dominio de la web.
- **Web (Netlify):** CSP que solo permite código propio (el único script en línea está autorizado por hash, y un test verifica que coincida), `frame-ancestors` limitado al sitio y al portafolio, `nosniff`, `Referrer-Policy` y `Permissions-Policy`.

## Contenedores

- Las imágenes de la API y la web corren con usuarios **sin privilegios de root**.
- La imagen final de la API no incluye compiladores, CLIs ni herramientas de test (build multi-etapa).
- `.dockerignore` impide que archivos `.env` terminen dentro de una imagen.
- En `docker compose`, la API no se publica hacia afuera: solo la ve nginx dentro de la red de Docker. La base y la web escuchan solo en `127.0.0.1`.

## Secretos

- Ningún secreto vive en el repositorio: `.env` está en `.gitignore`, y la historia completa se revisó en busca de credenciales.
- En producción, la URL de la base y el secreto JWT están en las variables de entorno de Render. El secreto JWT lo genera Render de forma aleatoria. La API no arranca si falta alguna variable o es inválida.

## Demo pública

La demo comparte las mismas cuentas entre todos los visitantes. Para que nadie pueda arruinarla:

- **`DEMO_MODE=true`:** la API rechaza crear usuarios, cambiar contraseñas o roles y desactivar cuentas (código `DEMO_READ_ONLY`), y la web lo explica en la página Equipo. Lo cubre un test e2e.
- **Reseteo diario:** el workflow [`reset-demo.yml`](.github/workflows/reset-demo.yml) recarga los datos de ejemplo cada madrugada, así se limpia cualquier cambio de precios, ventas o productos. Corre sobre la rama `production`, para no aplicar migraciones que todavía no salieron en un release.
- **Sin bloqueo por cuenta:** como la contraseña es pública, bloquear una cuenta por intentos fallidos no protege nada y permitiría dejar sin demo a todos los visitantes.

## GitHub Actions

- El CI corre con un token de solo lectura (`permissions: contents: read`). Solo el workflow de release puede crear tags y releases, y solo al mergear un PR a `production`.
- Los títulos de PR se leen como variables de entorno, nunca interpolados en el script, para que no puedan inyectar comandos.
- Los secretos (`DEMO_DATABASE_URL`) solo los usa el reseteo de la demo, que no corre en forks.

## Riesgos aceptados

| Riesgo | Por qué se acepta |
| --- | --- |
| La contraseña de la demo (`demo1234`) es pública | Es intencional para que cualquiera pruebe la app. El modo demo impide usarla para tomar el control de las cuentas. |
| `npm audit` reporta 4 alertas altas en `mysql2` y `deepmerge-ts` | Son dependencias internas del CLI de Prisma, que solo aplica migraciones. `mysql2` solo se usaría con MySQL (la app usa PostgreSQL) y `deepmerge-ts` solo combina la configuración interna de Prisma, sin datos de usuarios. Forzar las versiones corregidas rompe Prisma; se actualizará cuando Prisma publique una versión que las incluya. |
| La documentación Swagger (`/api/docs`) es pública | No expone datos: solo describe los endpoints, que igual exigen autenticación. Es útil para quien revisa el proyecto. |
| Los contadores de intentos de login viven en memoria | La API corre en una sola instancia. Si se reinicia, los contadores vuelven a cero, pero la ventana es de solo 15 minutos y el límite por IP sigue activo. Con varias instancias habría que llevarlos a la base o a Redis. |

¿Encontraste un problema de seguridad? Escribime a adrian.gette@icloud.com.
