# 0002 · Dinero en centavos enteros

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

En JavaScript `0.1 + 0.2 !== 0.3`. Un sistema que suma tickets, calcula márgenes y aplica aumentos porcentuales acumula errores de redondeo si trabaja con decimales de punto flotante.

## Decisión

Todos los montos se guardan, se transmiten y se calculan como **centavos enteros** (`Int` en Postgres, `number` entero en TypeScript). Solo se convierten a pesos para mostrarlos (`formatMoney`) o al leer lo que escribe el usuario (`parsePesos`, que entiende `1.250,50`).

Al aplicar porcentajes, `adjustAmount` limpia el ruido de punto flotante (`toFixed(6)`) antes de redondear hacia arriba. Si no, `1000 × 1,1 = 1100,0000000000002` se redondearía a 1101.

## Consecuencias

- ✅ Los totales de una venta coinciden exactamente con la suma de sus líneas.
- ✅ Los reportes suman con `SUM()` en SQL sin perder precisión y se convierten a `number` (seguro hasta 2^53 centavos).
- ⚠️ Toda entrada y salida de montos pasa por los helpers. Nadie debe hacer `precio * 100` a mano.
