# 0004 · Sesión: access token en memoria y refresh token en cookie httpOnly

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

Guardar un JWT en `localStorage` es cómodo, pero cualquier XSS lo puede leer. Usar solo cookies de sesión exige protección CSRF en cada request.

## Decisión

- **Access token** (JWT, 15 min) solo **en memoria** de la app. Viaja en el header `Authorization`.
- **Refresh token** opaco (32 bytes aleatorios) en una **cookie httpOnly** limitada a `/api/auth`. En la base se guarda solo su hash SHA-256.
- **Rotación:** cada refresh invalida el token usado y emite uno nuevo de la misma familia. Si alguien reutiliza un token ya rotado (pasada una ventana de gracia de 10 s, que cubre la carrera entre pestañas), se revoca toda la familia: es la señal típica de un token robado.
- El cliente comparte **una única renovación en vuelo** entre todas las requests que reciben 401 a la vez.
- El guard de la API **relee el usuario** en cada request: desactivar a alguien o cambiarle el rol tiene efecto inmediato, no recién cuando vence el token.
- En producción, Netlify **reenvía `/api/*`** a la API. Para el navegador la cookie es *first-party* (`SameSite=Lax`), lo que evita el bloqueo de cookies de terceros de Safari y Chrome y reduce la superficie de CSRF.

## Consecuencias

- ✅ Un XSS no puede robar una sesión persistente: el refresh token no es accesible desde JavaScript.
- ✅ Al recargar la página la sesión se recupera sola con la cookie.
- ⚠️ Si se despliega sin el proxy, hay que usar `COOKIE_SAME_SITE=none`, que depende de que el navegador acepte cookies de terceros.
