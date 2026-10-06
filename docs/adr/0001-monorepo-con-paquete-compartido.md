# 0001 · Monorepo con un paquete de dominio compartido

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

La web y la API validan los mismos datos (productos, ventas, ajustes de stock), aplican las mismas reglas (permisos por rol, redondeo de precios) y comparten los tipos de las respuestas. Si cada lado tiene su propia copia, tarde o temprano se desincronizan: el formulario acepta algo que la API rechaza, o la vista previa de un aumento muestra un precio distinto del que se guarda.

## Decisión

Un monorepo con npm workspaces y tres paquetes:

- `packages/shared`: esquemas Zod, tipos de los DTO y funciones puras de dominio (`adjustAmount`, `can`, `marginPercent`, manejo de dinero y fechas). No depende de React ni de Nest.
- `apps/api`: NestJS, que valida cada request con los esquemas compartidos (`ZodValidationPipe`) y genera Swagger a partir de ellos.
- `apps/web`: React, que usa los mismos esquemas en los formularios (`zodResolver`) y las mismas funciones para mostrar vistas previas.

En desarrollo la web importa el código fuente de `shared` mediante un alias de Vite, sin build intermedio. La API consume la versión compilada a CommonJS.

## Consecuencias

- ✅ Una regla se cambia en un solo lugar y los dos lados la respetan. Ejemplo: `adjustAmount` calcula tanto el ejemplo en vivo de la pantalla de precios como el valor que guarda la API.
- ✅ Los mensajes de validación en español salen de un único lugar (`z.config(z.locales.es())` y mensajes propios).
- ⚠️ Hay que compilar `shared` antes de levantar la API (`npm run build:shared`, incluido en `npm run setup`).
