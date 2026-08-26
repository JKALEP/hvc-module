-- Fase 6 del rediseño · el comentario DEL CONJUNTO
--
-- Una foto se sube sola o en tanda. Cada foto puede llevar su comentario
-- (`fotoId`, que existe desde la Fase 6 de v3) y la TANDA puede llevar el
-- suyo. El agrupador dejó de ser el álbum en la Fase 4 y pasó a ser la
-- intervención, así que el comentario de conjunto cuelga de ella.
--
-- Todo es opcional y nada se excluye: una subida en conjunto puede llevar
-- comentario de grupo, comentarios por foto, los dos o ninguno.

ALTER TABLE "comentarios_fotos" ADD COLUMN "intervencionId" INTEGER;

ALTER TABLE "comentarios_fotos"
  ADD CONSTRAINT "comentarios_fotos_intervencionId_fkey"
  FOREIGN KEY ("intervencionId") REFERENCES "intervenciones_fotos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "comentarios_fotos_intervencionId_creadoEn_idx"
  ON "comentarios_fotos" ("intervencionId", "creadoEn");

-- ⚠️ El CHECK de «un solo dueño» pasa de contar CUATRO huecos a contar CINCO.
-- Se suelta y se vuelve a crear EXPLÍCITAMENTE: dejar el viejo en pie sería
-- peor que no tenerlo, porque seguiría exigiendo que exactamente una de las
-- cuatro columnas viejas esté rellena y ningún comentario de intervención
-- podría entrar. Prisma no sabe declarar esto, así que nada en el `.prisma`
-- delata que existe salvo el comentario que se puso a propósito.
ALTER TABLE "comentarios_fotos"
  DROP CONSTRAINT IF EXISTS "comentarios_fotos_un_solo_dueno_chk";

ALTER TABLE "comentarios_fotos"
  ADD CONSTRAINT "comentarios_fotos_un_solo_dueno_chk" CHECK (
    ("carpetaId"      IS NOT NULL)::int +
    ("intervencionId" IS NOT NULL)::int +
    ("actividadId"    IS NOT NULL)::int +
    ("albumId"        IS NOT NULL)::int +
    ("fotoId"         IS NOT NULL)::int = 1
  );

-- ⚠️ `albumId` se queda en la tabla y en el CHECK, pero SIN puerta en la API.
-- No se migra ninguna fila porque no hay ninguna: medido en solo lectura
-- antes de escribir esta migración —0 comentarios de álbum en local y 0 en
-- Neon—. Un hueco que nadie llenó no es historia que preservar; lo que se
-- conserva es la columna, para no tener que decidir por una base que no he
-- medido.
