-- Fase 3 del rediseño de Fotos: evidencia fotográfica por actividad.
--
-- Cada actividad declara QUÉ se espera fotografiar —nada, una foto, o un
-- antes y un después—, y cada foto de actividad puede ocupar uno de los dos
-- huecos.

CREATE TYPE "TipoEvidenciaFotos" AS ENUM ('NINGUNA', 'UNA', 'ANTES_DESPUES');
CREATE TYPE "MomentoEvidenciaFotos" AS ENUM ('ANTES', 'DESPUES');

-- ── El catálogo propone la evidencia, como propone el nombre ─────────────

ALTER TABLE "definiciones_actividad_fotos"
  ADD COLUMN "evidencia" "TipoEvidenciaFotos" NOT NULL DEFAULT 'UNA';

-- ── Y la actividad la lleva copiada ──────────────────────────────────────

ALTER TABLE "actividades_fotos"
  ADD COLUMN "evidencia" "TipoEvidenciaFotos" NOT NULL DEFAULT 'UNA';

-- ⚠️ Las actividades que YA existían pasan a NINGUNA, no al defecto.
--
-- El defecto de la columna es 'UNA' porque es lo razonable para lo que se
-- cree a partir de ahora. Pero aplicárselo a lo ya recorrido marcaría como
-- «falta evidencia» un trabajo que se hizo cuando esta regla no existía —y
-- en un ciclo cerrado ni siquiera se podría arreglar, porque no admite
-- cambios—. Es el mismo criterio con el que los valores viejos de los enums
-- de la bitácora se dejaron de solo lectura en vez de reescribirlos: no se
-- reinterpreta el pasado con una regla de hoy.
UPDATE "actividades_fotos" SET "evidencia" = 'NINGUNA';

-- ── El hueco de la foto ──────────────────────────────────────────────────

ALTER TABLE "fotos" ADD COLUMN "momento" "MomentoEvidenciaFotos";

-- ⚠️ Tercer CHECK de la tabla `fotos` que Prisma no sabe declarar (van 4
-- objetos de este tipo en el módulo, contando el índice parcial de ciclos).
--
-- Un `momento` sin actividad no significa nada: una foto de álbum no tiene
-- antes ni después, y una de la bandeja de §18 tampoco está en ningún
-- checklist. El service lo valida para dar el mensaje en español; esto es el
-- último candado, porque un service se puede saltar y un CHECK no.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fotos_momento_solo_actividad_chk'
  ) THEN
    ALTER TABLE "fotos" ADD CONSTRAINT "fotos_momento_solo_actividad_chk"
      CHECK ("momento" IS NULL OR "actividadId" IS NOT NULL);
  END IF;
END $$;

-- Buscar «el antes de esta actividad» es la consulta de cada tarjeta.
CREATE INDEX "fotos_actividadId_momento_idx" ON "fotos"("actividadId", "momento");
