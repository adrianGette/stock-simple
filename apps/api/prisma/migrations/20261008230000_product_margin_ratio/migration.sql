-- Margen sobre el precio de venta como fracción (0.4 = 40 %), calculado por Postgres.
-- Es una columna generada: se recalcula sola cada vez que cambia el precio o el costo, así que
-- nunca queda desactualizada, y permite ordenar el listado por margen sin traer todo a memoria.
-- Es decimal (double precision) y no entero en puntos básicos: con costos muy superiores al
-- precio, (precio - costo) * 10000 no entra en un integer. Se usa solo para ordenar, no para plata.
ALTER TABLE "products" ADD COLUMN "margin_ratio" DOUBLE PRECISION
  GENERATED ALWAYS AS (
    CASE WHEN "price_cents" > 0 THEN ("price_cents" - "cost_cents")::double precision / "price_cents" END
  ) STORED;
