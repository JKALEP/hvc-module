-- Fase 2 del rediseño de Fotos: tipo de sistema (con su familia) y el
-- catálogo de actividades estándar que se preselecciona a partir de él.
--
-- Todo lo que se crea aquí es CONFIGURACIÓN administrable, no constantes:
-- HVC añade, renombra, reordena y retira sin que nadie toque código.

-- ── Familias y tipos de sistema ──────────────────────────────────────────

CREATE TABLE "familias_sistema_fotos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "familias_sistema_fotos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "familias_sistema_fotos_nombre_key" ON "familias_sistema_fotos"("nombre");
CREATE INDEX "familias_sistema_fotos_orden_idx" ON "familias_sistema_fotos"("orden");

CREATE TABLE "tipos_sistema_fotos" (
    "id" SERIAL NOT NULL,
    "familiaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tipos_sistema_fotos_pkey" PRIMARY KEY ("id")
);

-- Único DENTRO de la familia: «Estándar» puede existir en Aire Acondicionado
-- y en Ventilación sin ser el mismo tipo.
CREATE UNIQUE INDEX "tipos_sistema_fotos_familiaId_nombre_key" ON "tipos_sistema_fotos"("familiaId", "nombre");
CREATE INDEX "tipos_sistema_fotos_familiaId_idx" ON "tipos_sistema_fotos"("familiaId");
CREATE INDEX "tipos_sistema_fotos_orden_idx" ON "tipos_sistema_fotos"("orden");

ALTER TABLE "tipos_sistema_fotos" ADD CONSTRAINT "tipos_sistema_fotos_familiaId_fkey"
    FOREIGN KEY ("familiaId") REFERENCES "familias_sistema_fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── El catálogo de actividades ───────────────────────────────────────────

CREATE TABLE "definiciones_actividad_fotos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "definiciones_actividad_fotos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "definiciones_actividad_fotos_nombre_key" ON "definiciones_actividad_fotos"("nombre");
CREATE INDEX "definiciones_actividad_fotos_orden_idx" ON "definiciones_actividad_fotos"("orden");

CREATE TABLE "actividades_por_tipo_sistema_fotos" (
    "definicionId" INTEGER NOT NULL,
    "tipoSistemaId" INTEGER NOT NULL,
    CONSTRAINT "actividades_por_tipo_sistema_fotos_pkey" PRIMARY KEY ("definicionId", "tipoSistemaId")
);

CREATE INDEX "actividades_por_tipo_sistema_fotos_tipoSistemaId_idx" ON "actividades_por_tipo_sistema_fotos"("tipoSistemaId");

-- Cascade en las dos: la fila puente no significa nada sin sus dos extremos,
-- y no es contenido de nadie — es la asociación misma.
ALTER TABLE "actividades_por_tipo_sistema_fotos" ADD CONSTRAINT "actividades_por_tipo_sistema_fotos_definicionId_fkey"
    FOREIGN KEY ("definicionId") REFERENCES "definiciones_actividad_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "actividades_por_tipo_sistema_fotos" ADD CONSTRAINT "actividades_por_tipo_sistema_fotos_tipoSistemaId_fkey"
    FOREIGN KEY ("tipoSistemaId") REFERENCES "tipos_sistema_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── El tipo de sistema, en la carpeta de equipo ──────────────────────────
--
-- Nullable, como todo lo del equipo en este módulo: un campo obligatorio
-- puede trabar la creación en obra. RESTRICT porque un tipo que se borra
-- dejaría equipos apuntando al vacío; el service manda retirarlo en su lugar.

ALTER TABLE "carpetas_fotos" ADD COLUMN "tipoSistemaId" INTEGER;
CREATE INDEX "carpetas_fotos_tipoSistemaId_idx" ON "carpetas_fotos"("tipoSistemaId");
ALTER TABLE "carpetas_fotos" ADD CONSTRAINT "carpetas_fotos_tipoSistemaId_fkey"
    FOREIGN KEY ("tipoSistemaId") REFERENCES "tipos_sistema_fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Siembra ──────────────────────────────────────────────────────────────
--
-- SOLO las dos familias, que son las que HVC nombró. Los TIPOS concretos y
-- las actividades del catálogo se dejan VACÍOS a propósito: inventarlos aquí
-- metería datos falsos («Split pared», «Revisar pernos») que HVC tendría que
-- ir a limpiar antes de poder cargar los suyos, y a diferencia de los estados
-- de equipo aquí nadie ha dicho cuáles son. La pantalla de administración lo
-- dice en su estado vacío.

INSERT INTO "familias_sistema_fotos" ("nombre", "orden", "actualizadoEn") VALUES
  ('Aire Acondicionado', 1, CURRENT_TIMESTAMP),
  ('Ventilación',        2, CURRENT_TIMESTAMP);

-- ── Bitácora ─────────────────────────────────────────────────────────────

ALTER TYPE "EntidadFotos" ADD VALUE IF NOT EXISTS 'FAMILIA_SISTEMA';
ALTER TYPE "EntidadFotos" ADD VALUE IF NOT EXISTS 'TIPO_SISTEMA';
ALTER TYPE "EntidadFotos" ADD VALUE IF NOT EXISTS 'DEFINICION_ACTIVIDAD';
