# 0003 · Ventas atómicas, sin sobreventa e idempotentes

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

Un comercio puede tener dos cajas vendiendo a la vez y conexiones inestables. Hay tres riesgos:

1. **Sobreventa:** dos cajas venden la última unidad al mismo tiempo y el stock queda en −1.
2. **Ventas a medias:** se descuenta el stock de un producto y falla el siguiente.
3. **Duplicados:** el POS reintenta tras un timeout y la venta se registra dos veces.

## Decisión

- Toda la venta corre en **una transacción** de Postgres. Si algo falla, no se aplica nada.
- El stock se descuenta con un **UPDATE condicional**: `UPDATE products SET stock = stock - $q WHERE id = $id AND stock >= $q RETURNING ...`. Si no afecta filas, no había stock y la transacción se aborta con `INSUFFICIENT_STOCK`. Del mismo `RETURNING` salen el precio y el costo vigentes en el instante exacto de la reserva.
- Los productos se bloquean **siempre en el mismo orden** (por id) para evitar deadlocks entre ventas concurrentes.
- El número de venta correlativo sale de un contador por comercio, que se incrementa dentro de la transacción. Así no quedan huecos ni repetidos.
- El cliente envía una **clave de idempotencia** (UUID) por intento de venta, con un índice único `(business_id, idempotency_key)`. Un reintento devuelve la venta original. El carrito genera una clave nueva cada vez que cambia su contenido.
- Cada cambio de stock queda en un **libro de movimientos** (`stock_movements`) con el stock resultante. `products.stock` es un caché que se actualiza en la misma transacción.

## Consecuencias

- ✅ Lo demuestra un test e2e: 12 ventas concurrentes de 1 unidad con stock 5 dan exactamente 5 aprobadas, 7 rechazadas, stock final 0 y números 1 a 5.
- ✅ Hay auditoría completa: se puede reconstruir el stock de cualquier producto en cualquier momento.
- ⚠️ El contador de ventas serializa las ventas de un mismo comercio. Para un comercio chico es irrelevante. Si hiciera falta escalar, se puede pasar a una secuencia de Postgres por comercio.
