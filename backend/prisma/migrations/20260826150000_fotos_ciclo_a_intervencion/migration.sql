-- Ciclo → Intervención.
--
-- «Intervención» es el término elegido a propósito: en climatización HVAC no
-- toda visita a un equipo es mantenimiento preventivo — también hay
-- correcciones, puestas en marcha y atención de fallas. «Ciclo» sugería una
-- rutina periódica; el nombre neutral es el correcto.
--
-- ⚠️ TODO son RENAME, nunca DROP + CREATE. Prisma propone lo segundo al ver
-- cambiar el nombre de un modelo, y eso VACÍA la tabla — aquí hay filas
-- dentro. Es la misma disciplina de la Fase 0 (Tarea → Actividad).

-- ── La tabla y sus columnas ──────────────────────────────────────────────

ALTER TABLE "ciclos_fotos" RENAME TO "intervenciones_fotos";

ALTER TABLE "fotos" RENAME COLUMN "cicloId" TO "intervencionId";
ALTER TABLE "actividades_fotos" RENAME COLUMN "cicloId" TO "intervencionId";
ALTER TABLE "observaciones_fotos" RENAME COLUMN "cicloOrigenId" TO "intervencionOrigenId";
ALTER TABLE "observaciones_fotos" RENAME COLUMN "cicloResueltaId" TO "intervencionResueltaId";

-- ── Índices y claves, renombrados explícitamente ─────────────────────────
--
-- Postgres los arrastra con la tabla pero conservando el nombre viejo, y
-- entonces Prisma ve «drift» en la siguiente migración. Se renombran a mano
-- para que el esquema real y el `.prisma` digan lo mismo.

ALTER INDEX "ciclos_fotos_pkey" RENAME TO "intervenciones_fotos_pkey";
ALTER INDEX "ciclos_fotos_carpetaId_numero_key" RENAME TO "intervenciones_fotos_carpetaId_numero_key";
ALTER INDEX "ciclos_fotos_carpetaId_abiertoEn_idx" RENAME TO "intervenciones_fotos_carpetaId_abiertoEn_idx";

-- ⚠️ EL invariante del módulo: una sola intervención ABIERTA por equipo.
--
-- Es un índice único PARCIAL (`WHERE "cerradoEn" IS NULL`) y Prisma no sabe
-- declararlo, así que vive solo aquí. Renombrarlo es obligatorio: si se
-- quedara con el nombre viejo, el mensaje que la base devuelve al rechazar
-- una segunda intervención abierta seguiría diciendo «ciclos_fotos…».
ALTER INDEX "ciclos_fotos_un_solo_abierto_idx" RENAME TO "intervenciones_fotos_una_sola_abierta_idx";

ALTER TABLE "intervenciones_fotos" RENAME CONSTRAINT "ciclos_fotos_carpetaId_fkey" TO "intervenciones_fotos_carpetaId_fkey";
ALTER TABLE "intervenciones_fotos" RENAME CONSTRAINT "ciclos_fotos_estadoId_fkey" TO "intervenciones_fotos_estadoId_fkey";
ALTER TABLE "intervenciones_fotos" RENAME CONSTRAINT "ciclos_fotos_abiertoPorId_fkey" TO "intervenciones_fotos_abiertoPorId_fkey";
ALTER TABLE "intervenciones_fotos" RENAME CONSTRAINT "ciclos_fotos_cerradoPorId_fkey" TO "intervenciones_fotos_cerradoPorId_fkey";

ALTER TABLE "fotos" RENAME CONSTRAINT "fotos_cicloId_fkey" TO "fotos_intervencionId_fkey";
ALTER INDEX "fotos_cicloId_creadoEn_idx" RENAME TO "fotos_intervencionId_creadoEn_idx";

ALTER TABLE "actividades_fotos" RENAME CONSTRAINT "actividades_fotos_cicloId_fkey" TO "actividades_fotos_intervencionId_fkey";
ALTER INDEX "actividades_fotos_cicloId_estado_idx" RENAME TO "actividades_fotos_intervencionId_estado_idx";

ALTER TABLE "observaciones_fotos" RENAME CONSTRAINT "observaciones_fotos_cicloOrigenId_fkey" TO "observaciones_fotos_intervencionOrigenId_fkey";
ALTER TABLE "observaciones_fotos" RENAME CONSTRAINT "observaciones_fotos_cicloResueltaId_fkey" TO "observaciones_fotos_intervencionResueltaId_fkey";
ALTER INDEX "observaciones_fotos_cicloOrigenId_idx" RENAME TO "observaciones_fotos_intervencionOrigenId_idx";

-- ⚠️ El CHECK de «un solo dueño» nombra `cicloId`, y NO hay que tocarlo:
-- Postgres referencia las columnas por número de atributo, no por nombre, así
-- que un RENAME COLUMN lo deja válido y su definición pasa a leerse con el
-- nombre nuevo. Se comprueba con `pg_get_constraintdef` después de aplicar —
-- fue lo que salió bien solo en la Fase 0 y conviene volver a confirmarlo.

-- ── Bitácora: se AÑADEN los nuevos, los viejos quedan de solo lectura ─────
--
-- Renombrar los valores existentes reescribiría el pasado: un evento de
-- agosto pasaría a decir que se abrió una «intervención» cuando el módulo
-- todavía hablaba de ciclos. Mismo trato que `TAREA_COMPLETADA` en la Fase 0
-- y que `EQUIPO` en la 1a.

ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'INTERVENCION_ABIERTA';
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'INTERVENCION_CERRADA';
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'INTERVENCION_REABIERTA';
ALTER TYPE "EntidadFotos" ADD VALUE IF NOT EXISTS 'INTERVENCION';
