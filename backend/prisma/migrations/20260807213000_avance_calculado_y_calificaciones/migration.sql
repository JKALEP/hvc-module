-- Migración escrita a mano: Prisma habría generado DROP + ADD y se habrían
-- perdido los 31 valores de calificacionPersonal y las 8 filas de
-- avances_semanales. Aquí todo son RENAME, sin pérdida de datos.

-- ─────────────────────────────────────────────────────────────
-- reportes_diarios
-- ─────────────────────────────────────────────────────────────

-- calificacionPersonal evaluaba al personal en obra, que es personal de la
-- contratista: su sucesor natural es calificacionProveedor.
ALTER TABLE "reportes_diarios"
  RENAME COLUMN "calificacionPersonal" TO "calificacionProveedor";

ALTER TABLE "reportes_diarios"
  ADD COLUMN "calificacionSupervisor" DECIMAL(5,2);

-- Expectativa manual: nullable a propósito, un 0 diría "se esperaban cero
-- contratistas" en los reportes históricos, que es falso.
ALTER TABLE "reportes_diarios"
  ADD COLUMN "numeroContratistasProgramados" INTEGER;

-- Calculado, igual que tecnicosLaborando.
ALTER TABLE "reportes_diarios"
  ADD COLUMN "numeroContratistasTrabajando" INTEGER NOT NULL DEFAULT 0;

-- Backfill del calculado sobre los reportes que ya existen: empresas
-- distintas entre las participaciones de cada reporte.
UPDATE "reportes_diarios" r
SET "numeroContratistasTrabajando" = COALESCE(sub.n, 0)
FROM (
  SELECT "reporteId", COUNT(DISTINCT "empresaId")::int AS n
  FROM "participaciones"
  GROUP BY "reporteId"
) AS sub
WHERE sub."reporteId" = r.id;

-- ─────────────────────────────────────────────────────────────
-- avances_semanales -> ajustes_avance
-- Deja de ser "estimación semanal" y pasa a ser "override excepcional".
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "avances_semanales" RENAME TO "ajustes_avance";

-- anio y semana solo existían para sostener el unique semanal.
DROP INDEX IF EXISTS "avances_semanales_proyectoId_anio_semana_key";
ALTER TABLE "ajustes_avance" DROP COLUMN "anio";
ALTER TABLE "ajustes_avance" DROP COLUMN "semana";

-- Nombres de índices, constraints y secuencia alineados con el nombre
-- nuevo, para que los diffs futuros de Prisma salgan limpios.
ALTER INDEX IF EXISTS "avances_semanales_proyectoId_fecha_idx"
  RENAME TO "ajustes_avance_proyectoId_fecha_idx";
ALTER TABLE "ajustes_avance"
  RENAME CONSTRAINT "avances_semanales_pkey" TO "ajustes_avance_pkey";
ALTER TABLE "ajustes_avance"
  RENAME CONSTRAINT "avances_semanales_proyectoId_fkey" TO "ajustes_avance_proyectoId_fkey";
ALTER SEQUENCE IF EXISTS "avances_semanales_id_seq" RENAME TO "ajustes_avance_id_seq";
