-- Fase 2 del módulo Costos — el modelo de datos completo.
--
-- Dos movimientos:
--   1. Se RETIRA el modelo viejo (importaciones, productos,
--      historial_precios y el enum Estado).
--   2. Se CREA el proceso real: requerimiento → cotización de proveedor
--      → evaluación → aprobación → costo, con sus catálogos, plantillas
--      de correo versionadas y bitácora.
--
-- ⚠️ La parte 1 BORRA DATOS. Confirmado con HVC que las tres tablas solo
-- tienen pruebas, ninguna información real. El módulo viejo era un
-- capturador de precios sobre Excel y no representaba ningún proceso, así
-- que no hay nada que migrar hacia el modelo nuevo: un `producto` no es
-- un ítem de requerimiento ni un costo, es las dos cosas a medias.
--
-- Todas las tablas nuevas llevan prefijo `costos_`. El módulo de Equipos
-- ya ocupa el nombre `cotizaciones` con el significado contrario (allí
-- HVC emite hacia su cliente; aquí recibe de su proveedor).
--
-- Verificar después de aplicar:
--   SELECT count(*) FROM cotizaciones;      -- las de Equipos, intactas
--   SELECT count(*) FROM ordenes_compra;    -- intactas
--   SELECT count(*) FROM usuarios;          -- intactas
--   \dt costos_*                            -- 17 tablas nuevas

-- ═══ 1. Fuera el modelo viejo ═══════════════════════════════════════

DROP TABLE IF EXISTS "historial_precios";
DROP TABLE IF EXISTS "productos";
DROP TABLE IF EXISTS "importaciones";
DROP TYPE IF EXISTS "Estado";

-- ═══ 2. Enums del proceso ═══════════════════════════════════════════

CREATE TYPE "EstadoCatalogo" AS ENUM ('ACTIVO', 'INACTIVO');

CREATE TYPE "TipoCatalogo" AS ENUM (
  'TIPO_MANTENIMIENTO',
  'TIPO_REQUERIMIENTO',
  'UNIDAD_MEDIDA'
);

-- Los 12 estados de §11 más OBSERVADO. §27-29 describe que el Gestor
-- observa y el Solicitante corrige: ese «la pelota es del Solicitante»
-- es un lugar distinto de «esperando que el Gestor lo mire», y sin
-- estado propio ambos serían PENDIENTE_REVISION.
CREATE TYPE "EstadoRequerimiento" AS ENUM (
  'BORRADOR',
  'PENDIENTE_REVISION',
  'OBSERVADO',
  'PENDIENTE_COTIZACION',
  'COTIZACIONES_RECIBIDAS',
  'EN_EVALUACION',
  'PENDIENTE_APROBACION',
  'APROBADO',
  'RECHAZADO',
  'SIN_ACUERDO',
  'PENDIENTE_REGISTRO_COSTO',
  'FINALIZADO',
  'CANCELADO'
);

CREATE TYPE "EstadoObservacion" AS ENUM ('PENDIENTE', 'ATENDIDA');

CREATE TYPE "EstadoEnvio" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

CREATE TYPE "EstadoCotizacionProveedor" AS ENUM (
  'REGISTRADA',
  'RECOMENDADA',
  'APROBADA',
  'RECHAZADA',
  'DESCARTADA'
);

CREATE TYPE "DecisionAprobacion" AS ENUM (
  'ACEPTADA',
  'RECHAZADA',
  'SIN_ACUERDO'
);

CREATE TYPE "TipoPlantilla" AS ENUM ('SOLICITUD_COTIZACION');

CREATE TYPE "EntidadCostos" AS ENUM (
  'REQUERIMIENTO',
  'REQUERIMIENTO_ITEM',
  'OBSERVACION',
  'SOLICITUD_COTIZACION',
  'COTIZACION',
  'EVALUACION',
  'APROBACION',
  'COSTO',
  'PROVEEDOR',
  'CLIENTE',
  'SUPERVISOR',
  'CATALOGO',
  'PLANTILLA'
);

CREATE TYPE "AccionCostos" AS ENUM (
  'CREACION',
  'EDICION',
  'CAMBIO_ESTADO',
  'ELIMINACION',
  'EMISION',
  'OBSERVACION_EMITIDA',
  'OBSERVACION_CONFIRMADA',
  'ENVIO_CORREO',
  'RECOMENDACION',
  'DECISION',
  'REGISTRO_COSTO'
);

-- ═══ 3. Catálogos y entidades propias del módulo ════════════════════

CREATE TABLE "costos_opciones_catalogo" (
  "id"            SERIAL           NOT NULL,
  "tipo"          "TipoCatalogo"   NOT NULL,
  "valor"         TEXT             NOT NULL,
  "orden"         INTEGER          NOT NULL DEFAULT 0,
  "estado"        "EstadoCatalogo" NOT NULL DEFAULT 'ACTIVO',
  "creadoEn"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "costos_opciones_catalogo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_opciones_catalogo_tipo_valor_key"
  ON "costos_opciones_catalogo"("tipo", "valor");
CREATE INDEX "costos_opciones_catalogo_tipo_orden_idx"
  ON "costos_opciones_catalogo"("tipo", "orden");

CREATE TABLE "costos_clientes" (
  "id"            SERIAL           NOT NULL,
  "nombre"        TEXT             NOT NULL,
  "ruc"           TEXT,
  "contacto"      TEXT,
  "correo"        TEXT,
  "telefono"      TEXT,
  "direccion"     TEXT,
  "estado"        "EstadoCatalogo" NOT NULL DEFAULT 'ACTIVO',
  "creadoEn"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "costos_clientes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_clientes_nombre_key" ON "costos_clientes"("nombre");
CREATE INDEX "costos_clientes_estado_idx" ON "costos_clientes"("estado");
CREATE INDEX "costos_clientes_ruc_idx"    ON "costos_clientes"("ruc");

CREATE TABLE "costos_supervisores" (
  "id"            SERIAL           NOT NULL,
  "nombre"        TEXT             NOT NULL,
  "documento"     TEXT,
  "cargo"         TEXT,
  "correo"        TEXT,
  "telefono"      TEXT,
  "estado"        "EstadoCatalogo" NOT NULL DEFAULT 'ACTIVO',
  "creadoEn"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "costos_supervisores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_supervisores_documento_key"
  ON "costos_supervisores"("documento");
CREATE INDEX "costos_supervisores_estado_idx" ON "costos_supervisores"("estado");

CREATE TABLE "costos_proveedores" (
  "id"              SERIAL           NOT NULL,
  "ruc"             TEXT,
  "razonSocial"     TEXT             NOT NULL,
  "nombreComercial" TEXT,
  "correo"          TEXT,
  "telefono"        TEXT,
  "direccion"       TEXT,
  "estado"          "EstadoCatalogo" NOT NULL DEFAULT 'ACTIVO',
  "creadoEn"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"   TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "costos_proveedores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_proveedores_ruc_key" ON "costos_proveedores"("ruc");
CREATE INDEX "costos_proveedores_razonSocial_idx" ON "costos_proveedores"("razonSocial");
CREATE INDEX "costos_proveedores_correo_idx"      ON "costos_proveedores"("correo");
CREATE INDEX "costos_proveedores_estado_idx"      ON "costos_proveedores"("estado");

-- ═══ 4. Plantillas de correo, versionadas ═══════════════════════════
-- Van antes que las solicitudes: éstas apuntan a una versión.

CREATE TABLE "costos_plantillas_correo" (
  "id"            SERIAL          NOT NULL,
  "tipo"          "TipoPlantilla" NOT NULL,
  "nombre"        TEXT            NOT NULL,
  "creadoEn"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "costos_plantillas_correo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_plantillas_correo_tipo_key"
  ON "costos_plantillas_correo"("tipo");

CREATE TABLE "costos_plantillas_correo_version" (
  "id"          SERIAL       NOT NULL,
  "plantillaId" INTEGER      NOT NULL,
  "version"     INTEGER      NOT NULL,
  "asunto"      TEXT         NOT NULL,
  "cuerpo"      TEXT         NOT NULL,
  "activa"      BOOLEAN      NOT NULL DEFAULT false,
  "creadoPorId" INTEGER,
  "creadoEn"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "costos_plantillas_correo_version_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_plantillas_correo_version_plantillaId_version_key"
  ON "costos_plantillas_correo_version"("plantillaId", "version");
CREATE INDEX "costos_plantillas_correo_version_plantillaId_activa_idx"
  ON "costos_plantillas_correo_version"("plantillaId", "activa");

-- ═══ 5. El requerimiento y sus ítems ════════════════════════════════

CREATE TABLE "costos_requerimientos" (
  "id"                      SERIAL                NOT NULL,
  -- NULL mientras es BORRADOR. Se asigna al emitir (§25), desde la
  -- SEQUENCE requerimiento_numero_seq creada en la migración anterior.
  "numero"                  TEXT,
  "estado"                  "EstadoRequerimiento" NOT NULL DEFAULT 'BORRADOR',
  "tipoMantenimientoId"     INTEGER               NOT NULL,
  "tipoMantenimientoNombre" TEXT                  NOT NULL,
  "tipoRequerimientoId"     INTEGER               NOT NULL,
  "tipoRequerimientoNombre" TEXT                  NOT NULL,
  "supervisorId"            INTEGER               NOT NULL,
  "supervisorNombre"        TEXT                  NOT NULL,
  "clienteId"               INTEGER               NOT NULL,
  "clienteNombre"           TEXT                  NOT NULL,
  "lugarEntrega"            TEXT                  NOT NULL,
  "fechaEntrega"            DATE                  NOT NULL,
  -- §18 y §65: la del documento, movible por quien tenga permiso.
  "fechaEmision"            DATE                  NOT NULL,
  -- La de creación real. Esta NO se toca: es la de auditoría.
  "creadoEn"                TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"           TIMESTAMP(3)          NOT NULL,
  "emitidoEn"               TIMESTAMP(3),
  "cerradoEn"               TIMESTAMP(3),
  "solicitanteId"           INTEGER,

  CONSTRAINT "costos_requerimientos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_requerimientos_numero_key"
  ON "costos_requerimientos"("numero");
CREATE INDEX "costos_requerimientos_estado_creadoEn_idx"
  ON "costos_requerimientos"("estado", "creadoEn");
CREATE INDEX "costos_requerimientos_solicitanteId_estado_idx"
  ON "costos_requerimientos"("solicitanteId", "estado");
CREATE INDEX "costos_requerimientos_clienteId_idx"
  ON "costos_requerimientos"("clienteId");
CREATE INDEX "costos_requerimientos_supervisorId_idx"
  ON "costos_requerimientos"("supervisorId");

CREATE TABLE "costos_requerimiento_items" (
  "id"                 SERIAL       NOT NULL,
  "requerimientoId"    INTEGER      NOT NULL,
  "orden"              INTEGER      NOT NULL DEFAULT 0,
  "descripcion"        TEXT         NOT NULL,
  "unidad"             TEXT         NOT NULL,
  -- Entero: §21 dice que la cantidad de un ítem pedido es un entero.
  "cantidad"           INTEGER      NOT NULL,
  "detalleObservacion" TEXT,
  "referencias"        TEXT,
  "creadoEn"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "costos_requerimiento_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "costos_requerimiento_items_requerimientoId_orden_idx"
  ON "costos_requerimiento_items"("requerimientoId", "orden");

CREATE TABLE "costos_observaciones" (
  "id"              SERIAL              NOT NULL,
  "requerimientoId" INTEGER             NOT NULL,
  "texto"           TEXT                NOT NULL,
  "estado"          "EstadoObservacion" NOT NULL DEFAULT 'PENDIENTE',
  "creadoPorId"     INTEGER,
  "respuesta"       TEXT,
  "confirmadaPorId" INTEGER,
  "confirmadaEn"    TIMESTAMP(3),
  "creadoEn"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"   TIMESTAMP(3)        NOT NULL,

  CONSTRAINT "costos_observaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "costos_observaciones_requerimientoId_estado_idx"
  ON "costos_observaciones"("requerimientoId", "estado");

-- ═══ 6. Solicitudes y cotizaciones de proveedor ═════════════════════

CREATE TABLE "costos_solicitudes_cotizacion" (
  "id"                 SERIAL        NOT NULL,
  "requerimientoId"    INTEGER       NOT NULL,
  "proveedorId"        INTEGER       NOT NULL,
  "destinatario"       TEXT          NOT NULL,
  "plantillaVersionId" INTEGER,
  "estadoEnvio"        "EstadoEnvio" NOT NULL DEFAULT 'PENDIENTE',
  "errorEnvio"         TEXT,
  "enviadoPorId"       INTEGER,
  "creadoEn"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadoEn"          TIMESTAMP(3),

  CONSTRAINT "costos_solicitudes_cotizacion_pkey" PRIMARY KEY ("id")
);

-- Sin UNIQUE(requerimientoId, proveedorId): §44 admite volver a pedirle
-- al mismo proveedor en una segunda vuelta.
CREATE INDEX "costos_solicitudes_cotizacion_requerimientoId_proveedorId_idx"
  ON "costos_solicitudes_cotizacion"("requerimientoId", "proveedorId");
CREATE INDEX "costos_solicitudes_cotizacion_estadoEnvio_idx"
  ON "costos_solicitudes_cotizacion"("estadoEnvio");

CREATE TABLE "costos_cotizaciones_proveedor" (
  "id"              SERIAL                      NOT NULL,
  "requerimientoId" INTEGER                     NOT NULL,
  "proveedorId"     INTEGER                     NOT NULL,
  "solicitudId"     INTEGER,
  "estado"          "EstadoCotizacionProveedor" NOT NULL DEFAULT 'REGISTRADA',
  "garantia"        TEXT,
  "plazoEntrega"    TEXT,
  "condicionesPago" TEXT,
  "observaciones"   TEXT,
  -- La del documento del proveedor, no la de registro (§65).
  "fechaCotizacion" DATE                        NOT NULL,
  "validaHasta"     DATE,
  "registradaPorId" INTEGER,
  "creadoEn"        TIMESTAMP(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"   TIMESTAMP(3)                NOT NULL,

  CONSTRAINT "costos_cotizaciones_proveedor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "costos_cotizaciones_proveedor_requerimientoId_estado_idx"
  ON "costos_cotizaciones_proveedor"("requerimientoId", "estado");
CREATE INDEX "costos_cotizaciones_proveedor_proveedorId_idx"
  ON "costos_cotizaciones_proveedor"("proveedorId");

CREATE TABLE "costos_cotizacion_items" (
  "id"                  SERIAL        NOT NULL,
  "cotizacionId"        INTEGER       NOT NULL,
  -- NULL = línea que el proveedor añadió y nadie pidió (flete,
  -- instalación). §36 admite que cada proveedor arme lo suyo.
  "requerimientoItemId" INTEGER,
  "orden"               INTEGER       NOT NULL DEFAULT 0,
  "descripcion"         TEXT          NOT NULL,
  "unidad"              TEXT,
  -- Decimal aquí, entero en el requerimiento: se piden 3 rollos pero se
  -- cotizan 45,5 metros.
  "cantidad"            DECIMAL(14,4) NOT NULL,
  "precioUnitario"      DECIMAL(14,4) NOT NULL,
  "creadoEn"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"       TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "costos_cotizacion_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "costos_cotizacion_items_cotizacionId_orden_idx"
  ON "costos_cotizacion_items"("cotizacionId", "orden");
CREATE INDEX "costos_cotizacion_items_requerimientoItemId_idx"
  ON "costos_cotizacion_items"("requerimientoItemId");

-- ═══ 7. Evaluación, aprobación y costo ══════════════════════════════

CREATE TABLE "costos_evaluaciones" (
  "id"              SERIAL       NOT NULL,
  "requerimientoId" INTEGER      NOT NULL,
  "cotizacionId"    INTEGER      NOT NULL,
  -- La vuelta del ciclo de §44. La recomendación vigente es la de ronda
  -- más alta; no hay booleano `vigente` que apagar a mano.
  "ronda"           INTEGER      NOT NULL DEFAULT 1,
  "justificacion"   TEXT         NOT NULL,
  "gestorId"        INTEGER,
  "creadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "costos_evaluaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_evaluaciones_requerimientoId_ronda_key"
  ON "costos_evaluaciones"("requerimientoId", "ronda");
CREATE INDEX "costos_evaluaciones_cotizacionId_idx"
  ON "costos_evaluaciones"("cotizacionId");

CREATE TABLE "costos_aprobaciones" (
  "id"              SERIAL               NOT NULL,
  "requerimientoId" INTEGER              NOT NULL,
  "evaluacionId"    INTEGER,
  "decision"        "DecisionAprobacion" NOT NULL,
  "comentario"      TEXT,
  "aprobadorId"     INTEGER,
  "creadoEn"        TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "costos_aprobaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "costos_aprobaciones_requerimientoId_creadoEn_idx"
  ON "costos_aprobaciones"("requerimientoId", "creadoEn");

CREATE TABLE "costos_costos" (
  "id"                   SERIAL       NOT NULL,
  "requerimientoId"      INTEGER      NOT NULL,
  "proveedorId"          INTEGER      NOT NULL,
  "cotizacionId"         INTEGER      NOT NULL,
  -- Snapshot de §48: a quién se le compró, congelado.
  "proveedorRazonSocial" TEXT         NOT NULL,
  "proveedorRuc"         TEXT,
  "proveedorTelefono"    TEXT,
  "registradoPorId"      INTEGER,
  "creadoEn"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "costos_costos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_costos_requerimientoId_key"
  ON "costos_costos"("requerimientoId");
CREATE INDEX "costos_costos_proveedorId_idx" ON "costos_costos"("proveedorId");

CREATE TABLE "costos_costo_items" (
  "id"                  SERIAL        NOT NULL,
  "costoId"             INTEGER       NOT NULL,
  "requerimientoItemId" INTEGER,
  "orden"               INTEGER       NOT NULL DEFAULT 0,
  -- Snapshot de las cinco columnas de §49: §53 prohíbe perder un valor
  -- histórico, y §54 avisa de que el ítem puede cambiar después.
  "descripcion"         TEXT          NOT NULL,
  "unidad"              TEXT          NOT NULL,
  "cantidad"            INTEGER       NOT NULL,
  "detalleObservacion"  TEXT,
  "referencias"         TEXT,
  -- POR UNIDAD DE MEDIDA, nunca el total de la línea. El total es
  -- cantidad × costoUnitario y se calcula en lectura.
  "costoUnitario"       DECIMAL(14,4) NOT NULL,
  "creadoEn"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"       TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "costos_costo_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "costos_costo_items_costoId_orden_idx"
  ON "costos_costo_items"("costoId", "orden");
-- La Base de Costos (§52) busca por descripción.
CREATE INDEX "costos_costo_items_descripcion_idx"
  ON "costos_costo_items"("descripcion");

-- ═══ 8. Bitácora del módulo ═════════════════════════════════════════

CREATE TABLE "costos_eventos" (
  "id"              SERIAL          NOT NULL,
  -- El hilo de §64. NULL en las acciones de administración, que no
  -- cuelgan de ningún requerimiento.
  "requerimientoId" INTEGER,
  "entidad"         "EntidadCostos" NOT NULL,
  "entidadId"       INTEGER         NOT NULL,
  "accion"          "AccionCostos"  NOT NULL,
  "usuarioId"       INTEGER,
  -- Snapshot: borrar una cuenta pone la FK a null, y una auditoría que
  -- ya no sabe quién hizo qué no es una auditoría.
  "usuarioNombre"   TEXT,
  "campoAfectado"   TEXT,
  "valorAnterior"   TEXT,
  "valorNuevo"      TEXT,
  "motivo"          TEXT,
  "descripcion"     TEXT,
  "creadoEn"        TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "costos_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "costos_eventos_requerimientoId_creadoEn_idx"
  ON "costos_eventos"("requerimientoId", "creadoEn");
CREATE INDEX "costos_eventos_entidad_entidadId_creadoEn_idx"
  ON "costos_eventos"("entidad", "entidadId", "creadoEn");

-- ═══ 9. Claves foráneas ═════════════════════════════════════════════
--
-- Criterio, el mismo que el resto del repositorio:
--   · CASCADE  → lo que no tiene sentido sin su dueño (ítems, líneas,
--                observaciones, eventos de un requerimiento).
--   · RESTRICT → los catálogos y las entidades referenciadas: no se
--                borra un proveedor que tiene cotizaciones.
--   · SET NULL → los usuarios: dar de baja una cuenta no puede borrar
--                un requerimiento ni vaciar la bitácora.

ALTER TABLE "costos_plantillas_correo_version"
  ADD CONSTRAINT "costos_plantillas_correo_version_plantillaId_fkey"
  FOREIGN KEY ("plantillaId") REFERENCES "costos_plantillas_correo"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_plantillas_correo_version"
  ADD CONSTRAINT "costos_plantillas_correo_version_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_requerimientos"
  ADD CONSTRAINT "costos_requerimientos_tipoMantenimientoId_fkey"
  FOREIGN KEY ("tipoMantenimientoId") REFERENCES "costos_opciones_catalogo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "costos_requerimientos"
  ADD CONSTRAINT "costos_requerimientos_tipoRequerimientoId_fkey"
  FOREIGN KEY ("tipoRequerimientoId") REFERENCES "costos_opciones_catalogo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "costos_requerimientos"
  ADD CONSTRAINT "costos_requerimientos_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "costos_supervisores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "costos_requerimientos"
  ADD CONSTRAINT "costos_requerimientos_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "costos_clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "costos_requerimientos"
  ADD CONSTRAINT "costos_requerimientos_solicitanteId_fkey"
  FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_requerimiento_items"
  ADD CONSTRAINT "costos_requerimiento_items_requerimientoId_fkey"
  FOREIGN KEY ("requerimientoId") REFERENCES "costos_requerimientos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_observaciones"
  ADD CONSTRAINT "costos_observaciones_requerimientoId_fkey"
  FOREIGN KEY ("requerimientoId") REFERENCES "costos_requerimientos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_observaciones"
  ADD CONSTRAINT "costos_observaciones_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_observaciones"
  ADD CONSTRAINT "costos_observaciones_confirmadaPorId_fkey"
  FOREIGN KEY ("confirmadaPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_solicitudes_cotizacion"
  ADD CONSTRAINT "costos_solicitudes_cotizacion_requerimientoId_fkey"
  FOREIGN KEY ("requerimientoId") REFERENCES "costos_requerimientos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_solicitudes_cotizacion"
  ADD CONSTRAINT "costos_solicitudes_cotizacion_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "costos_proveedores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "costos_solicitudes_cotizacion"
  ADD CONSTRAINT "costos_solicitudes_cotizacion_plantillaVersionId_fkey"
  FOREIGN KEY ("plantillaVersionId") REFERENCES "costos_plantillas_correo_version"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_solicitudes_cotizacion"
  ADD CONSTRAINT "costos_solicitudes_cotizacion_enviadoPorId_fkey"
  FOREIGN KEY ("enviadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_cotizaciones_proveedor"
  ADD CONSTRAINT "costos_cotizaciones_proveedor_requerimientoId_fkey"
  FOREIGN KEY ("requerimientoId") REFERENCES "costos_requerimientos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_cotizaciones_proveedor"
  ADD CONSTRAINT "costos_cotizaciones_proveedor_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "costos_proveedores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "costos_cotizaciones_proveedor"
  ADD CONSTRAINT "costos_cotizaciones_proveedor_solicitudId_fkey"
  FOREIGN KEY ("solicitudId") REFERENCES "costos_solicitudes_cotizacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_cotizaciones_proveedor"
  ADD CONSTRAINT "costos_cotizaciones_proveedor_registradaPorId_fkey"
  FOREIGN KEY ("registradaPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_cotizacion_items"
  ADD CONSTRAINT "costos_cotizacion_items_cotizacionId_fkey"
  FOREIGN KEY ("cotizacionId") REFERENCES "costos_cotizaciones_proveedor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_cotizacion_items"
  ADD CONSTRAINT "costos_cotizacion_items_requerimientoItemId_fkey"
  FOREIGN KEY ("requerimientoItemId") REFERENCES "costos_requerimiento_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_evaluaciones"
  ADD CONSTRAINT "costos_evaluaciones_requerimientoId_fkey"
  FOREIGN KEY ("requerimientoId") REFERENCES "costos_requerimientos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_evaluaciones"
  ADD CONSTRAINT "costos_evaluaciones_cotizacionId_fkey"
  FOREIGN KEY ("cotizacionId") REFERENCES "costos_cotizaciones_proveedor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_evaluaciones"
  ADD CONSTRAINT "costos_evaluaciones_gestorId_fkey"
  FOREIGN KEY ("gestorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_aprobaciones"
  ADD CONSTRAINT "costos_aprobaciones_requerimientoId_fkey"
  FOREIGN KEY ("requerimientoId") REFERENCES "costos_requerimientos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_aprobaciones"
  ADD CONSTRAINT "costos_aprobaciones_evaluacionId_fkey"
  FOREIGN KEY ("evaluacionId") REFERENCES "costos_evaluaciones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_aprobaciones"
  ADD CONSTRAINT "costos_aprobaciones_aprobadorId_fkey"
  FOREIGN KEY ("aprobadorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_costos"
  ADD CONSTRAINT "costos_costos_requerimientoId_fkey"
  FOREIGN KEY ("requerimientoId") REFERENCES "costos_requerimientos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_costos"
  ADD CONSTRAINT "costos_costos_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "costos_proveedores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "costos_costos"
  ADD CONSTRAINT "costos_costos_cotizacionId_fkey"
  FOREIGN KEY ("cotizacionId") REFERENCES "costos_cotizaciones_proveedor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "costos_costos"
  ADD CONSTRAINT "costos_costos_registradoPorId_fkey"
  FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_costo_items"
  ADD CONSTRAINT "costos_costo_items_costoId_fkey"
  FOREIGN KEY ("costoId") REFERENCES "costos_costos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_costo_items"
  ADD CONSTRAINT "costos_costo_items_requerimientoItemId_fkey"
  FOREIGN KEY ("requerimientoItemId") REFERENCES "costos_requerimiento_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "costos_eventos"
  ADD CONSTRAINT "costos_eventos_requerimientoId_fkey"
  FOREIGN KEY ("requerimientoId") REFERENCES "costos_requerimientos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "costos_eventos"
  ADD CONSTRAINT "costos_eventos_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
