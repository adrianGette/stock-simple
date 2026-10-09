-- Foto de perfil de cada usuario: WebP cuadrado de 256 px, unos 20 KB (el límite es 200 KB).
-- Se guarda en la base: sin servicios externos y queda incluida en los backups.
ALTER TABLE "users" ADD COLUMN "photo" BYTEA,
ADD COLUMN "photo_updated_at" TIMESTAMPTZ(3);
