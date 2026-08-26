-- Actividades sin «detalle», y observaciones por actividad.
--
-- ⚠️ ESTA MIGRACIÓN BORRA COLUMNAS. Se comprobó antes, en las DOS bases, que
-- no hay un solo dato que perder:
--
--     local  → 49 actividades · 0 con descripción · 0 con prioridad
--                             · 0 con fecha       · 0 con responsable
--     Neon   →  1 actividad   · 0 / 0 / 0 / 0
--
-- Ése es el criterio: los cuatro campos son exclusivos de Fotos —los
-- `prioridad`/`responsable` de `src/equipos/` son suyos y no tienen nada que
-- ver— y ninguno llegó a usarse nunca. Por eso se retiran de la tabla en vez
-- de recibir el trato de «dejar de exponer pero conservar» que sí se dio a
-- los valores viejos de los enums de la bitácora: allí HABÍA filas que
-- habrían empezado a mentir; aquí no hay ninguna.
--
-- Una actividad pasa a ser lo que de verdad se usa en obra: un nombre, un
-- check, su evidencia fotográfica, sus fotos, sus observaciones y sus
-- comentarios.

ALTER TABLE "actividades_fotos" DROP CONSTRAINT IF EXISTS "actividades_fotos_responsableId_fkey";
DROP INDEX IF EXISTS "actividades_fotos_responsableId_estado_idx";

ALTER TABLE "actividades_fotos" DROP COLUMN "descripcion";
ALTER TABLE "actividades_fotos" DROP COLUMN "prioridad";
ALTER TABLE "actividades_fotos" DROP COLUMN "fecha";
ALTER TABLE "actividades_fotos" DROP COLUMN "responsableId";

-- El enum se va con su única columna. No lo usa nada más: los tres valores
-- solo existían para esa columna, y `src/equipos/` tiene su propia prioridad.
DROP TYPE IF EXISTS "PrioridadActividadFotos";

-- ── Observaciones ligadas a una actividad concreta ───────────────────────
--
-- Una observación podía ser solo del equipo; ahora también puede ser DE una
-- actividad («el filtro está roto» cuelga de «Revisar filtros»).
--
-- ⚠️ SetNull y no Cascade, a propósito. Una actividad es de UNA visita —cada
-- ciclo crea las suyas—, así que atar la observación a su vida la borraría al
-- borrar la actividad. Una observación pendiente no se resuelve borrándola:
-- perder el puntero es aceptable, perder el pendiente no.

ALTER TABLE "observaciones_fotos" ADD COLUMN "actividadId" INTEGER;

CREATE INDEX "observaciones_fotos_actividadId_idx" ON "observaciones_fotos"("actividadId");

ALTER TABLE "observaciones_fotos" ADD CONSTRAINT "observaciones_fotos_actividadId_fkey"
    FOREIGN KEY ("actividadId") REFERENCES "actividades_fotos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
