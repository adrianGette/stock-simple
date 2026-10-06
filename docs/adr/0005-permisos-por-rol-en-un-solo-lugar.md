# 0005 · Permisos por rol definidos una sola vez

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

Hay tres roles: dueño/a, encargado/a y cajero/a. La UI tiene que ocultar lo que un rol no puede hacer, y la API tiene que impedirlo de verdad. Si las reglas se escriben dos veces, divergen.

## Decisión

- `packages/shared/src/permissions.ts` define permisos granulares (`products:view-cost`, `sales:void`, `prices:bulk-update`…) y la función `can(role, permission)`.
- La API los exige con `@RequirePermissions(...)` y un guard global. Todas las rutas son privadas salvo las marcadas con `@Public()`.
- La web arma el menú y las rutas con el mismo `can`. Una ruta sin permiso redirige al inicio del rol.
- Los datos sensibles se filtran **en el servidor**: un cajero no recibe `costCents` en ninguna respuesta, no basta con esconderlo en la UI.
- **Multi-tenant:** cada consulta filtra por el `businessId` del usuario autenticado. Un test e2e verifica que un comercio no puede leer ni vender productos de otro.

## Consecuencias

- ✅ Agregar un rol o un permiso se hace en un archivo y lo respetan los dos lados.
- ✅ La seguridad no depende de la UI.
