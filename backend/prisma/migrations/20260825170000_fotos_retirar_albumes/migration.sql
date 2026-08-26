-- Fase 4 del rediseño de Fotos: se retiran los ÁLBUMES.
--
-- Una foto pasa a colgar de un CICLO (lo suelto de la visita) o de una
-- ACTIVIDAD (su evidencia); las dos en null siguen siendo la bandeja de §18.
-- El álbum era el agrupador de v2 y el ciclo lo sustituye: agrupar por visita
-- es lo que HVC pregunta, y tener las dos cosas obligaba a elegir dónde mirar.
--
-- ⚠️ ESTA MIGRACIÓN MUEVE DATOS. Lo que hace con cada foto:
--
--   · foto de un álbum en carpeta de tipo EQUIPO  → al ciclo ABIERTO de ese
--     equipo (o al más reciente, si no hay ninguno abierto)
--   · foto de un álbum en carpeta CORRIENTE       → a la BANDEJA de quien la
--     subió, porque una carpeta corriente no tiene ciclos donde ponerla
--   · foto ya en una actividad o en la bandeja    → no se toca
--
-- Ninguna foto se borra y ningún objeto de R2 se mueve: la clave se guarda por
-- foto, así que reorganizar el bucket sería gastar red y arriesgar huérfanos a
-- cambio de nada. Una foto no cambia de clave nunca.

-- ── El nuevo dueño ───────────────────────────────────────────────────────

ALTER TABLE "fotos" ADD COLUMN "cicloId" INTEGER;

ALTER TABLE "fotos" ADD CONSTRAINT "fotos_cicloId_fkey"
  FOREIGN KEY ("cicloId") REFERENCES "ciclos_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "fotos_cicloId_creadoEn_idx" ON "fotos"("cicloId", "creadoEn");

-- ── Mover lo que estaba en álbumes de EQUIPOS ────────────────────────────
--
-- Se elige el ciclo abierto y, si no lo hay, el de número más alto: la visita
-- en curso es donde alguien seguiría trabajando, y un equipo sin ninguna
-- abierta tiene su última visita como el sitio menos sorprendente.

UPDATE "fotos" f
SET "cicloId" = elegido.id
FROM (
  SELECT a.id AS "albumId",
         (SELECT ci.id
            FROM "ciclos_fotos" ci
           WHERE ci."carpetaId" = a."carpetaId"
           ORDER BY (ci."cerradoEn" IS NULL) DESC, ci.numero DESC
           LIMIT 1) AS id
    FROM "albumes_fotos" a
    JOIN "carpetas_fotos" c ON c.id = a."carpetaId"
   WHERE c.tipo = 'EQUIPO'
) AS elegido
WHERE f."albumId" = elegido."albumId" AND elegido.id IS NOT NULL;

-- ⚠️ El NOMBRE del álbum no se pierde en silencio.
--
-- Un álbum con título lo escribió una persona, y en el modelo nuevo no hay
-- dónde ponerlo: el agrupador es el ciclo, que ya tiene su número y su fecha.
-- Se conserva como descripción de la foto SOLO si la foto no tenía ninguna,
-- así que nunca pisa lo que alguien escribió. Sin esto, retirar los álbumes
-- borraría texto de usuario sin dejar rastro.
UPDATE "fotos" f
SET "descripcion" = a."nombre"
FROM "albumes_fotos" a
WHERE f."albumId" = a.id
  AND f."descripcion" IS NULL
  AND a."nombre" IS NOT NULL
  AND a."nombre" <> '';

-- ── El guard: nada que debiera moverse se queda atrás ────────────────────
--
-- ⚠️ La comprobación se hace ANTES de soltar la columna, y mide lo que de
-- verdad importa: que ninguna foto de un álbum de EQUIPO se haya quedado sin
-- ciclo. Contar «cuántas conservan albumId» no serviría —las que SÍ se
-- movieron también lo conservan, porque nadie lo limpia hasta el paso
-- siguiente—, y esa versión de la comprobación abortó la primera pasada por
-- un motivo que no era el suyo. Queda anotado porque el guard hizo su trabajo:
-- paró antes de tirar la columna.
DO $$
DECLARE sin_mover INT;
BEGIN
  SELECT count(*) INTO sin_mover
    FROM "fotos" f
    JOIN "albumes_fotos" a ON a.id = f."albumId"
    JOIN "carpetas_fotos" c ON c.id = a."carpetaId"
   WHERE c.tipo = 'EQUIPO' AND f."cicloId" IS NULL;
  IF sin_mover > 0 THEN
    RAISE EXCEPTION
      'Quedan % foto(s) de equipos sin ciclo asignado; se aborta.', sin_mover;
  END IF;
END $$;

-- ── Se suelta el álbum ───────────────────────────────────────────────────
--
-- Las que recibieron ciclo se quedan en él; las que no —las de carpetas
-- corrientes— caen en la BANDEJA de §18 de quien las subió, que es privada
-- suya y desde donde puede reclasificarlas dentro de un equipo. No se borra
-- ninguna: es lo menos destructivo que se puede hacer con una foto que se
-- queda sin sitio.

UPDATE "fotos" SET "albumId" = NULL WHERE "albumId" IS NOT NULL;

-- ── Fuera la columna vieja ───────────────────────────────────────────────

DROP INDEX IF EXISTS "fotos_albumId_creadoEn_idx";
ALTER TABLE "fotos" DROP CONSTRAINT IF EXISTS "fotos_albumId_fkey";
ALTER TABLE "fotos" DROP COLUMN "albumId";

-- ── El CHECK de «un solo dueño», reescrito ───────────────────────────────
--
-- Decía «álbum o actividad, no las dos»; ahora dice «ciclo o actividad, no las
-- dos». Las dos en null siguen valiendo: es la bandeja de §18.
--
-- ⚠️ Se suelta y se vuelve a crear EXPLÍCITAMENTE en vez de dejar que el DROP
-- COLUMN lo arrastre: pasar de una regla a otra es una decisión y tiene que
-- verse en el diff. (Postgres lo habría borrado solo al quitar la columna que
-- nombra, dejando la tabla sin ninguna regla y sin que nada lo delatara.)

ALTER TABLE "fotos" DROP CONSTRAINT IF EXISTS "fotos_un_solo_dueno_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fotos_un_solo_dueno_chk'
  ) THEN
    ALTER TABLE "fotos" ADD CONSTRAINT "fotos_un_solo_dueno_chk"
      CHECK (NOT ("cicloId" IS NOT NULL AND "actividadId" IS NOT NULL));
  END IF;
END $$;

-- ── `albumes_fotos` SE QUEDA, y de solo lectura ──────────────────────────
--
-- No se borra la tabla ni sus filas, a propósito: `comentarios_fotos.albumId`
-- se conserva de solo lectura para no perder los comentarios que alguien
-- escribió sobre un álbum, y esa FK necesita que las filas existan. Mismo
-- trato que los valores viejos de los enums de la bitácora: lo que ya se
-- escribió no se reescribe.
--
-- Nada nuevo la toca: no quedan rutas de creación, edición ni borrado de
-- álbumes, y ninguna foto la referencia.
