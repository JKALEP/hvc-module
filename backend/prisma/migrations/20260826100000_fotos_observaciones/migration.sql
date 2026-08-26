-- Fase 5 del rediseño de Fotos: OBSERVACIONES (§8).
--
-- Lo que queda pendiente en un equipo, visita tras visita. Se levanta en un
-- ciclo, se resuelve en el mismo o en otro, y mientras nadie la resuelva
-- sigue apareciendo en cada visita nueva.
--
-- ⚠️ El «arrastre» NO se materializa: la observación cuelga del EQUIPO
-- (`carpetaId`) y solo recuerda en qué ciclo se levantó. No hay copia por
-- visita. Copiarla —como sí se copia el checklist al abrir un ciclo—
-- duplicaría la misma observación cinco veces, dejaría sin respuesta
-- «¿cuándo se levantó?» y obligaría a resolver la copia buena de entre
-- varias. El checklist se copia porque cada visita REHACE ese trabajo; una
-- observación no se rehace, se resuelve una vez.

CREATE TYPE "EstadoObservacionFotos" AS ENUM ('PENDIENTE', 'RESUELTA');

CREATE TABLE "observaciones_fotos" (
    "id" SERIAL NOT NULL,
    "carpetaId" INTEGER NOT NULL,
    "cicloOrigenId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "estado" "EstadoObservacionFotos" NOT NULL DEFAULT 'PENDIENTE',
    "creadoPorId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "resueltaEn" TIMESTAMP(3),
    "resueltaPorId" INTEGER,
    "cicloResueltaId" INTEGER,
    CONSTRAINT "observaciones_fotos_pkey" PRIMARY KEY ("id")
);

-- «Qué sigue pendiente en este equipo» es LA consulta de la fase.
CREATE INDEX "observaciones_fotos_carpetaId_estado_idx" ON "observaciones_fotos"("carpetaId", "estado");
CREATE INDEX "observaciones_fotos_cicloOrigenId_idx" ON "observaciones_fotos"("cicloOrigenId");

ALTER TABLE "observaciones_fotos" ADD CONSTRAINT "observaciones_fotos_carpetaId_fkey"
    FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "observaciones_fotos" ADD CONSTRAINT "observaciones_fotos_cicloOrigenId_fkey"
    FOREIGN KEY ("cicloOrigenId") REFERENCES "ciclos_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ⚠️ SetNull y no Cascade: si se borrara el ciclo donde se resolvió, la
-- observación sigue estando resuelta — lo que se pierde es DÓNDE, no el
-- hecho. Con Cascade se llevaría por delante una observación cerrada por el
-- sitio equivocado.
ALTER TABLE "observaciones_fotos" ADD CONSTRAINT "observaciones_fotos_cicloResueltaId_fkey"
    FOREIGN KEY ("cicloResueltaId") REFERENCES "ciclos_fotos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restrict en quien la creó, SetNull en quien la resolvió: es el mismo par
-- que ya usan las actividades. Una observación sin autor no se puede firmar;
-- una sin «resuelta por» sigue siendo una observación resuelta.
ALTER TABLE "observaciones_fotos" ADD CONSTRAINT "observaciones_fotos_creadoPorId_fkey"
    FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "observaciones_fotos" ADD CONSTRAINT "observaciones_fotos_resueltaPorId_fkey"
    FOREIGN KEY ("resueltaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Bitácora ─────────────────────────────────────────────────────────────

ALTER TYPE "EntidadFotos" ADD VALUE IF NOT EXISTS 'OBSERVACION';
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'OBSERVACION_RESUELTA';
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'OBSERVACION_REABIERTA';
