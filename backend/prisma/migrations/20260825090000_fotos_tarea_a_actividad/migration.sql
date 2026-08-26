-- Fase 0 del rediseño: «Tarea» pasa a llamarse «Actividad» en todo el módulo.
--
-- ⚠️ TODO es RENAME, no DROP + CREATE. Prisma propone lo segundo cuando ve
-- cambiar un nombre de modelo, y eso vaciaría la tabla: al escribir esta
-- migración había 2 filas en `tareas_fotos`. Con RENAME los datos, las claves
-- y los índices sobreviven intactos.

-- ── 1. La tabla y sus objetos ──
ALTER TABLE "tareas_fotos" RENAME TO "actividades_fotos";

ALTER INDEX "tareas_fotos_pkey" RENAME TO "actividades_fotos_pkey";
ALTER INDEX "tareas_fotos_carpetaId_estado_idx" RENAME TO "actividades_fotos_carpetaId_estado_idx";
ALTER INDEX "tareas_fotos_responsableId_estado_idx" RENAME TO "actividades_fotos_responsableId_estado_idx";

ALTER TABLE "actividades_fotos" RENAME CONSTRAINT "tareas_fotos_carpetaId_fkey" TO "actividades_fotos_carpetaId_fkey";
ALTER TABLE "actividades_fotos" RENAME CONSTRAINT "tareas_fotos_responsableId_fkey" TO "actividades_fotos_responsableId_fkey";
ALTER TABLE "actividades_fotos" RENAME CONSTRAINT "tareas_fotos_creadoPorId_fkey" TO "actividades_fotos_creadoPorId_fkey";
ALTER TABLE "actividades_fotos" RENAME CONSTRAINT "tareas_fotos_completadaPorId_fkey" TO "actividades_fotos_completadaPorId_fkey";

-- ── 2. Los enums propios de la actividad ──
ALTER TYPE "EstadoTareaFotos" RENAME TO "EstadoActividadFotos";
ALTER TYPE "PrioridadTareaFotos" RENAME TO "PrioridadActividadFotos";

-- ── 3. Las FK que apuntan a ella ──
--
-- Renombrar una columna NO invalida los CHECK que la nombran: Postgres los
-- referencia por número de atributo, así que `fotos_un_solo_dueno_chk` y
-- `comentarios_fotos_un_solo_dueno_chk` siguen valiendo y su definición pasa
-- a leerse con el nombre nuevo. Se comprueba después de aplicar.
ALTER TABLE "fotos" RENAME COLUMN "tareaId" TO "actividadId";
ALTER INDEX "fotos_tareaId_creadoEn_idx" RENAME TO "fotos_actividadId_creadoEn_idx";
ALTER TABLE "fotos" RENAME CONSTRAINT "fotos_tareaId_fkey" TO "fotos_actividadId_fkey";

ALTER TABLE "comentarios_fotos" RENAME COLUMN "tareaId" TO "actividadId";
ALTER INDEX "comentarios_fotos_tareaId_creadoEn_idx" RENAME TO "comentarios_fotos_actividadId_creadoEn_idx";
ALTER TABLE "comentarios_fotos" RENAME CONSTRAINT "comentarios_fotos_tareaId_fkey" TO "comentarios_fotos_actividadId_fkey";

-- ── 4. Enum de configuración VIVA: se renombra el valor ──
--
-- `TipoNodoPlantilla` describe qué crea un nodo de plantilla. No es historia:
-- es configuración que se sigue usando, así que el valor se renombra de
-- verdad y las plantillas ya guardadas pasan a decir ACTIVIDAD sin tocar
-- ninguna fila.
ALTER TYPE "TipoNodoPlantilla" RENAME VALUE 'TAREA' TO 'ACTIVIDAD';

-- ── 5. Enums de BITÁCORA: se AÑADEN, no se renombran ──
--
-- `EntidadFotos` y `AccionFotos` registran lo que ya pasó. Renombrar un valor
-- reescribiría el pasado: un evento de 2026 pasaría a afirmar que se completó
-- una «actividad» cuando en ese momento el módulo hablaba de tareas. Se añade
-- el término nuevo y el viejo queda solo de lectura — mismo trato que recibió
-- `EQUIPO` al retirar el enlace con Gestión de Equipos.
ALTER TYPE "EntidadFotos" ADD VALUE IF NOT EXISTS 'ACTIVIDAD';
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'ACTIVIDAD_COMPLETADA';
ALTER TYPE "AccionFotos" ADD VALUE IF NOT EXISTS 'ACTIVIDAD_REABIERTA';
