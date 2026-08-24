-- Fotos deja de depender del catálogo de Gestión de Equipos.
--
-- Hasta aquí, una carpeta de tipo EQUIPO apuntaba con una FK al equipo
-- real del otro módulo (§12 de la especificación de Fotos). Se retira
-- entero: el flujo cruzado —elegir organización, buscar el equipo,
-- elegirlo— generaba fricción real en obra, y la información del equipo
-- pasa a ser propia de Fotos y configurable (Fase 1b).
--
-- ⚠️ NO migra ni un dato. Se verificó en solo lectura, ANTES de escribir
-- esta migración, que ninguna carpeta llegó a enlazarse nunca:
--
--     carpetas_fotos WHERE tipo = 'EQUIPO'          → 0 filas (local y Neon)
--     carpetas_fotos WHERE "equipoId" IS NOT NULL   → 0 filas (local y Neon)
--
-- Por eso no hay copia de campos hacia la carpeta ni modo «enlazado» de
-- compatibilidad: no había nada que conservar.

-- 1. El CHECK que emparejaba tipo y equipo.
--
-- Lo añadió A MANO `20260816120000_fotos_v3_permisos_y_estructura`, porque
-- Prisma no sabe declarar condiciones entre columnas — y por lo mismo
-- tampoco sabe que existe, así que no lo incluye en el DDL que genera y
-- hay que quitarlo aquí explícitamente.
--
-- Postgres lo dejaría caer solo con el DROP COLUMN de más abajo (el CHECK
-- depende de `equipoId`), pero se escribe aparte a propósito: que el
-- módulo pase de tres CHECK a dos es una decisión, y tiene que verse en la
-- migración en vez de deducirse de un efecto colateral.
--
-- NO se sustituye por otro: con los campos configurables de la Fase 1b, una
-- carpeta de tipo EQUIPO no exige ninguna otra columna —todos los campos
-- son opcionales—, así que no queda ningún par de columnas que emparejar.
ALTER TABLE "carpetas_fotos" DROP CONSTRAINT IF EXISTS "carpetas_fotos_equipo_segun_tipo_chk";

-- 2. La FK, su índice y la columna.
ALTER TABLE "carpetas_fotos" DROP CONSTRAINT "carpetas_fotos_equipoId_fkey";
DROP INDEX "carpetas_fotos_equipoId_idx";
ALTER TABLE "carpetas_fotos" DROP COLUMN "equipoId";

-- 3. Corrección de drift AJENA a este cambio.
--
-- `cotizaciones."equipoId"` es una FK y su índice existe en la base desde
-- `20260813170000_lineas_cotizacion_oc`, pero nunca se declaró en el
-- schema. Al generar esta migración, Prisma lo leyó como sobrante y quiso
-- BORRARLO. La convención del repo es `@@index` en cada FK, así que la
-- base tenía razón: se declaró el índice en el schema y el DDL resultante
-- vuelve a ser vacío para esa tabla.
--
-- Se anota aquí, sin ejecutar nada, por lo mismo que la sección 8 de
-- `20260816120000_...`: un arreglo de drift que no deja rastro en el SQL
-- es un arreglo que nadie va a poder explicar dentro de seis meses.
