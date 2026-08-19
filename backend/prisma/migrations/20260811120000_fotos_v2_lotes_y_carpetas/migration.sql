-- Fotos v2: el álbum deja de ser una entidad que se nombra, y compartir
-- pasa a ser SOLO a nivel de carpeta.
--
-- Escrita a mano. La automática habría hecho DROP de `albumes_fotos` y
-- de la columna `albumId` de `fotos`, llevándose las fotos por delante.
-- Aquí NADA se borra antes de haberse traspasado, y las fotos no se
-- mueven de fila en ningún momento: solo se renombra su padre.

-- ── 1. Carpeta archivable ───────────────────────────────────────────
ALTER TABLE "sedes" ADD COLUMN "cerrada" BOOLEAN NOT NULL DEFAULT false;

-- ── 2. El álbum se convierte en lote ────────────────────────────────
-- Renombrar preserva las filas, sus ids y las claves foráneas que
-- apuntan a ellas. Las fotos siguen colgando de la misma fila.
ALTER TABLE "albumes_fotos" RENAME TO "lotes_fotos";
ALTER TABLE "lotes_fotos" RENAME CONSTRAINT "albumes_fotos_pkey" TO "lotes_fotos_pkey";
ALTER TABLE "lotes_fotos" RENAME CONSTRAINT "albumes_fotos_sedeId_fkey" TO "lotes_fotos_sedeId_fkey";
ALTER TABLE "lotes_fotos" RENAME CONSTRAINT "albumes_fotos_creadoPorId_fkey" TO "lotes_fotos_creadoPorId_fkey";
ALTER SEQUENCE "albumes_fotos_id_seq" RENAME TO "lotes_fotos_id_seq";

-- El nombre que el usuario eligió ("BATALLON 1") es información real:
-- se pliega en la descripción del lote ANTES de soltar la columna.
UPDATE "lotes_fotos"
SET "descripcion" = CASE
  WHEN "descripcion" IS NULL OR btrim("descripcion") = '' THEN "nombre"
  ELSE "nombre" || ' — ' || "descripcion"
END;

DROP INDEX IF EXISTS "albumes_fotos_sedeId_nombre_key";
DROP INDEX IF EXISTS "albumes_fotos_sedeId_idx";
ALTER TABLE "lotes_fotos" DROP COLUMN "nombre";
ALTER TABLE "lotes_fotos" DROP COLUMN "estado";
CREATE INDEX "lotes_fotos_sedeId_creadoEn_idx" ON "lotes_fotos"("sedeId", "creadoEn");

-- La foto apunta al lote. Solo cambia el nombre de la columna.
ALTER TABLE "fotos" RENAME COLUMN "albumId" TO "loteId";
ALTER TABLE "fotos" RENAME CONSTRAINT "fotos_albumId_fkey" TO "fotos_loteId_fkey";
DROP INDEX IF EXISTS "fotos_albumId_creadoEn_idx";
CREATE INDEX "fotos_loteId_creadoEn_idx" ON "fotos"("loteId", "creadoEn");

-- ── 3. Compartir solo carpetas ──────────────────────────────────────
-- PRIMERO se promueve el acceso a la carpeta del lote, y solo después se
-- suelta la columna. Al revés se perdería el acceso de quien lo tenía.
-- ON CONFLICT: si ya tenía la carpeta por otra vía, no se duplica.
INSERT INTO "accesos_compartidos" ("usuarioId", "sedeId", "otorgadoPorId", "creadoEn")
SELECT a."usuarioId", l."sedeId", a."otorgadoPorId", a."creadoEn"
FROM "accesos_compartidos" a
JOIN "lotes_fotos" l ON l."id" = a."albumId"
WHERE a."albumId" IS NOT NULL
ON CONFLICT ("usuarioId", "sedeId") DO NOTHING;

DELETE FROM "accesos_compartidos" WHERE "albumId" IS NOT NULL;

DROP INDEX IF EXISTS "accesos_compartidos_usuarioId_albumId_key";
ALTER TABLE "accesos_compartidos" DROP CONSTRAINT IF EXISTS "accesos_compartidos_albumId_fkey";
ALTER TABLE "accesos_compartidos" DROP COLUMN "albumId";
-- Ya no puede quedar ninguna fila sin carpeta.
ALTER TABLE "accesos_compartidos" ALTER COLUMN "sedeId" SET NOT NULL;

-- ── 4. Invitaciones: de una carpeta a varias ────────────────────────
CREATE TABLE "invitaciones_carpeta" (
    "id" SERIAL NOT NULL,
    "invitacionId" INTEGER NOT NULL,
    "sedeId" INTEGER NOT NULL,
    CONSTRAINT "invitaciones_carpeta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invitaciones_carpeta_invitacionId_sedeId_key" ON "invitaciones_carpeta"("invitacionId", "sedeId");
CREATE INDEX "invitaciones_carpeta_sedeId_idx" ON "invitaciones_carpeta"("sedeId");
ALTER TABLE "invitaciones_carpeta" ADD CONSTRAINT "invitaciones_carpeta_invitacionId_fkey" FOREIGN KEY ("invitacionId") REFERENCES "invitaciones_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitaciones_carpeta" ADD CONSTRAINT "invitaciones_carpeta_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las invitaciones que apuntaban a una carpeta pasan tal cual.
INSERT INTO "invitaciones_carpeta" ("invitacionId", "sedeId")
SELECT "id", "sedeId" FROM "invitaciones_cliente" WHERE "sedeId" IS NOT NULL;

-- Las que apuntaban a un lote se promueven a la carpeta de ese lote.
INSERT INTO "invitaciones_carpeta" ("invitacionId", "sedeId")
SELECT i."id", l."sedeId"
FROM "invitaciones_cliente" i
JOIN "lotes_fotos" l ON l."id" = i."albumId"
WHERE i."albumId" IS NOT NULL
ON CONFLICT ("invitacionId", "sedeId") DO NOTHING;

ALTER TABLE "invitaciones_cliente" DROP CONSTRAINT IF EXISTS "invitaciones_cliente_sedeId_fkey";
ALTER TABLE "invitaciones_cliente" DROP CONSTRAINT IF EXISTS "invitaciones_cliente_albumId_fkey";
ALTER TABLE "invitaciones_cliente" DROP COLUMN "sedeId";
ALTER TABLE "invitaciones_cliente" DROP COLUMN "albumId";

-- ── 5. Los tres lotes de prueba sin fotos ───────────────────────────
-- Solo los vacíos: un lote sin fotos no significa nada en el modelo nuevo.
DELETE FROM "lotes_fotos"
WHERE "id" NOT IN (SELECT DISTINCT "loteId" FROM "fotos");

-- ── 6. El enum del álbum ya no lo usa nadie ─────────────────────────
DROP TYPE IF EXISTS "EstadoAlbum";
