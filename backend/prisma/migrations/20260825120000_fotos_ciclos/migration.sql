-- Fase 1 del rediseño: CICLOS.
--
-- Un equipo pasa de tener UN set fijo de actividades a tener un historial de
-- visitas. Las actividades dejan de colgar de la carpeta y pasan a colgar
-- del ciclo.
--
-- ⚠️ Esta migración MUEVE datos: las actividades que ya existen se reparten
-- en el Ciclo 1 de su equipo. Por eso el orden importa y no se puede dejar
-- que Prisma la genere sola (propondría borrar `carpetaId` antes de haber
-- rellenado `cicloId`, y las actividades quedarían huérfanas).

-- ── 1. Catálogo de estados ──
CREATE TYPE "ColorEstadoFotos" AS ENUM ('VERDE', 'NARANJA', 'ROJO');

CREATE TABLE "estados_equipo_fotos" (
    "id"            SERIAL NOT NULL,
    "nombre"        TEXT NOT NULL,
    "color"         "ColorEstadoFotos" NOT NULL,
    "orden"         INTEGER NOT NULL DEFAULT 0,
    "activo"        BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "estados_equipo_fotos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estados_equipo_fotos_nombre_key" ON "estados_equipo_fotos"("nombre");
CREATE INDEX "estados_equipo_fotos_orden_idx" ON "estados_equipo_fotos"("orden");

-- Los tres de §7, sembrados como DATOS y no como constantes: se pueden
-- renombrar, reordenar o ampliar desde Configuración sin tocar código.
INSERT INTO "estados_equipo_fotos" ("nombre", "color", "orden", "actualizadoEn") VALUES
  ('Operativo',                  'VERDE',   0, NOW()),
  ('Operativo con observaciones','NARANJA', 1, NOW()),
  ('Inoperativo',                'ROJO',    2, NOW())
ON CONFLICT ("nombre") DO NOTHING;

-- ── 2. Ciclos ──
CREATE TABLE "ciclos_fotos" (
    "id"            SERIAL NOT NULL,
    "carpetaId"     INTEGER NOT NULL,
    "numero"        INTEGER NOT NULL,
    "estadoId"      INTEGER,
    "abiertoEn"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abiertoPorId"  INTEGER NOT NULL,
    "cerradoEn"     TIMESTAMP(3),
    "cerradoPorId"  INTEGER,
    "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ciclos_fotos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ciclos_fotos_carpetaId_numero_key" ON "ciclos_fotos"("carpetaId", "numero");
CREATE INDEX "ciclos_fotos_carpetaId_abiertoEn_idx" ON "ciclos_fotos"("carpetaId", "abiertoEn");

ALTER TABLE "ciclos_fotos" ADD CONSTRAINT "ciclos_fotos_carpetaId_fkey"
  FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ciclos_fotos" ADD CONSTRAINT "ciclos_fotos_estadoId_fkey"
  FOREIGN KEY ("estadoId") REFERENCES "estados_equipo_fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ciclos_fotos" ADD CONSTRAINT "ciclos_fotos_abiertoPorId_fkey"
  FOREIGN KEY ("abiertoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ciclos_fotos" ADD CONSTRAINT "ciclos_fotos_cerradoPorId_fkey"
  FOREIGN KEY ("cerradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ⚠️ EL INVARIANTE CENTRAL, y Prisma no sabe declararlo.
--
-- Un equipo tiene COMO MUCHO un ciclo abierto. Es un índice único PARCIAL:
-- restringe solo las filas sin cerrar, así que un equipo puede acumular
-- todos los ciclos cerrados que quiera y solo uno en curso.
--
-- Va en la base y no solo en el service porque un service se puede saltar
-- —una importación, una plantilla, una carrera entre dos peticiones— y un
-- índice no. Es el mismo criterio de los dos CHECK del módulo.
CREATE UNIQUE INDEX "ciclos_fotos_un_solo_abierto_idx"
  ON "ciclos_fotos" ("carpetaId") WHERE "cerradoEn" IS NULL;

-- ── 3. Las actividades pasan a colgar del ciclo ──
--
-- Orden: primero se crea la columna nullable, después se rellena creando el
-- Ciclo 1 de cada equipo que tenga actividades, y solo entonces se pone NOT
-- NULL y se retira `carpetaId`. Al revés se perderían filas.
ALTER TABLE "actividades_fotos" ADD COLUMN "cicloId" INTEGER;

-- Un Ciclo 1 ABIERTO por cada carpeta de tipo EQUIPO. Se le atribuye a su
-- propietario, que es el único usuario que la fila garantiza que existe.
INSERT INTO "ciclos_fotos" ("carpetaId", "numero", "abiertoPorId", "actualizadoEn")
SELECT c."id", 1, c."propietarioId", NOW()
FROM "carpetas_fotos" c
WHERE c."tipo" = 'EQUIPO';

-- Y las actividades que ya existían se cuelgan del Ciclo 1 de su equipo.
UPDATE "actividades_fotos" a
SET "cicloId" = ci."id"
FROM "ciclos_fotos" ci
WHERE ci."carpetaId" = a."carpetaId" AND ci."numero" = 1;

-- Red de seguridad: si alguna actividad quedara sin ciclo —una carpeta que
-- no fuese EQUIPO, que hoy no debería existir— la migración se detiene en
-- vez de borrarla en silencio al poner NOT NULL.
DO $$
DECLARE huerfanas INTEGER;
BEGIN
  SELECT count(*) INTO huerfanas FROM "actividades_fotos" WHERE "cicloId" IS NULL;
  IF huerfanas > 0 THEN
    RAISE EXCEPTION 'Hay % actividad(es) sin ciclo: su carpeta no es de tipo EQUIPO. Revisar antes de migrar.', huerfanas;
  END IF;
END $$;

ALTER TABLE "actividades_fotos" ALTER COLUMN "cicloId" SET NOT NULL;

DROP INDEX IF EXISTS "actividades_fotos_carpetaId_estado_idx";
ALTER TABLE "actividades_fotos" DROP CONSTRAINT "actividades_fotos_carpetaId_fkey";
ALTER TABLE "actividades_fotos" DROP COLUMN "carpetaId";

CREATE INDEX "actividades_fotos_cicloId_estado_idx" ON "actividades_fotos"("cicloId", "estado");
ALTER TABLE "actividades_fotos" ADD CONSTRAINT "actividades_fotos_cicloId_fkey"
  FOREIGN KEY ("cicloId") REFERENCES "ciclos_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. Bitácora ──
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'CICLO_ABIERTO';
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'CICLO_CERRADO';
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'CICLO_REABIERTO';
ALTER TYPE "EntidadFotos" ADD VALUE IF NOT EXISTS 'CICLO';
ALTER TYPE "EntidadFotos" ADD VALUE IF NOT EXISTS 'ESTADO_EQUIPO';
