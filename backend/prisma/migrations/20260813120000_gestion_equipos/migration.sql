-- Gestión de equipos — inventario que HVC administra para terceros.
--
-- Aditiva pura: 12 tablas y 6 tipos nuevos, más un valor en el enum
-- Modulo. NADA de lo existente se altera salvo ese enum, que solo gana
-- una opción. Ni una fila de otra tabla se toca.
--
-- Verificar después de aplicar:
--   SELECT count(*) FROM usuarios;    -- sin cambios
--   SELECT count(*) FROM equipos;     -- 0, tabla nueva

-- ── 1. El módulo entra al sistema de permisos ───────────────────────
-- Aunque de momento las rutas van con @SoloSuperAdmin(), añadirlo ahora
-- cuesta una línea; hacerlo después obliga a reetiquetar controllers.
ALTER TYPE "Modulo" ADD VALUE IF NOT EXISTS 'EQUIPOS';

-- ── 2. Tipos ────────────────────────────────────────────────────────
CREATE TYPE "TipoCampo" AS ENUM (
  'TEXTO', 'TEXTO_LARGO', 'NUMERO_ENTERO', 'NUMERO_DECIMAL', 'MONEDA',
  'FECHA', 'FECHA_HORA', 'BOOLEANO', 'LISTA', 'SELECCION_MULTIPLE',
  'ARCHIVO', 'IMAGEN', 'CORREO', 'TELEFONO', 'URL'
);

CREATE TYPE "EstadoIncidencia"  AS ENUM ('ABIERTA', 'EN_ATENCION', 'CERRADA');
CREATE TYPE "EstadoCotizacion"  AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('EMITIDA', 'EN_PROCESO', 'ATENDIDA', 'CANCELADA');

CREATE TYPE "TipoEventoHistorial" AS ENUM (
  'CREACION', 'CAMBIO_CAMPO', 'CAMBIO_ESTADO', 'RELACION_INCIDENCIA',
  'RELACION_COTIZACION', 'RELACION_ORDEN_COMPRA', 'FOTO_AGREGADA'
);

-- ── 3. Organización y su árbol de ubicaciones ───────────────────────
CREATE TABLE "organizaciones" (
  "id"            SERIAL       NOT NULL,
  "nombre"        TEXT         NOT NULL,
  -- Visibilidad, NO borrado lógico: una organización inactiva deja de
  -- ofrecerse al registrar equipos, pero los suyos siguen existiendo.
  "activo"        BOOLEAN      NOT NULL DEFAULT true,
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizaciones_nombre_key" ON "organizaciones"("nombre");
CREATE INDEX "organizaciones_activo_idx" ON "organizaciones"("activo");

-- Autorreferenciado y sin niveles fijos: una organización usa 2 niveles
-- y otra 5. Columnas fijas obligarían a migrar por cada cliente nuevo.
CREATE TABLE "nodos_estructura" (
  "id"             SERIAL       NOT NULL,
  "organizacionId" INTEGER      NOT NULL,
  "nombre"         TEXT         NOT NULL,
  "orden"          INTEGER      NOT NULL DEFAULT 0,
  "padreId"        INTEGER,
  "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "nodos_estructura_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nodos_estructura_padreId_nombre_key"
  ON "nodos_estructura"("padreId", "nombre");
CREATE INDEX "nodos_estructura_organizacionId_padreId_idx"
  ON "nodos_estructura"("organizacionId", "padreId");

-- ── 4. Campos dinámicos ─────────────────────────────────────────────
CREATE TABLE "definiciones_campo" (
  "id"             SERIAL       NOT NULL,
  "organizacionId" INTEGER      NOT NULL,
  "nombre"         TEXT         NOT NULL,
  -- Slug estable: sobrevive a que se renombre el campo visible.
  "clave"          TEXT         NOT NULL,
  "tipo"           "TipoCampo"  NOT NULL,
  "obligatorio"    BOOLEAN      NOT NULL DEFAULT false,
  "orden"          INTEGER      NOT NULL DEFAULT 0,
  "activo"         BOOLEAN      NOT NULL DEFAULT true,
  "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "definiciones_campo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "definiciones_campo_organizacionId_clave_key"
  ON "definiciones_campo"("organizacionId", "clave");
CREATE INDEX "definiciones_campo_organizacionId_orden_idx"
  ON "definiciones_campo"("organizacionId", "orden");

CREATE TABLE "opciones_campo" (
  "id"                SERIAL       NOT NULL,
  "definicionCampoId" INTEGER      NOT NULL,
  "etiqueta"          TEXT         NOT NULL,
  "orden"             INTEGER      NOT NULL DEFAULT 0,
  "activo"            BOOLEAN      NOT NULL DEFAULT true,
  "creadoEn"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "opciones_campo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "opciones_campo_definicionCampoId_etiqueta_key"
  ON "opciones_campo"("definicionCampoId", "etiqueta");
CREATE INDEX "opciones_campo_definicionCampoId_orden_idx"
  ON "opciones_campo"("definicionCampoId", "orden");

-- ── 5. Equipos ──────────────────────────────────────────────────────
CREATE TABLE "equipos" (
  "id"             SERIAL       NOT NULL,
  "organizacionId" INTEGER      NOT NULL,
  "nodoId"         INTEGER      NOT NULL,
  -- El "ITEM" del Excel del cliente: columna real y no campo dinámico,
  -- para que buscarlo no pase por la tabla EAV.
  "codigoInterno"  TEXT,
  "creadoPorId"    INTEGER,
  "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipos_organizacionId_codigoInterno_key"
  ON "equipos"("organizacionId", "codigoInterno");
CREATE INDEX "equipos_organizacionId_nodoId_idx" ON "equipos"("organizacionId", "nodoId");
CREATE INDEX "equipos_nodoId_idx" ON "equipos"("nodoId");

-- EAV: una fila por equipo y campo. Solo se llena la columna del tipo
-- que corresponde; el resto queda null. Los cuatro índices por tipo de
-- valor son lo que sostiene el argumento de elegir EAV sobre JSONB.
CREATE TABLE "valores_campo" (
  "id"                SERIAL        NOT NULL,
  "equipoId"          INTEGER       NOT NULL,
  "definicionCampoId" INTEGER       NOT NULL,
  "valorTexto"        TEXT,
  "valorNumero"       DECIMAL(14,4),
  "valorEntero"       INTEGER,
  "valorFecha"        TIMESTAMP(3),
  "valorBooleano"     BOOLEAN,
  "opcionId"          INTEGER,
  -- Clave en R2, nunca una URL firmada: el bucket es privado.
  "claveArchivo"      TEXT,
  "creadoEn"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"     TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "valores_campo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "valores_campo_equipoId_definicionCampoId_key"
  ON "valores_campo"("equipoId", "definicionCampoId");
CREATE INDEX "valores_campo_definicionCampoId_valorTexto_idx"
  ON "valores_campo"("definicionCampoId", "valorTexto");
CREATE INDEX "valores_campo_definicionCampoId_valorNumero_idx"
  ON "valores_campo"("definicionCampoId", "valorNumero");
CREATE INDEX "valores_campo_definicionCampoId_valorFecha_idx"
  ON "valores_campo"("definicionCampoId", "valorFecha");
CREATE INDEX "valores_campo_definicionCampoId_opcionId_idx"
  ON "valores_campo"("definicionCampoId", "opcionId");

-- Selección múltiple: tabla puente en vez de un array de Postgres, que
-- no entra en un B-tree ni tiene integridad contra opciones_campo.
CREATE TABLE "valores_campo_opcion" (
  "id"                 SERIAL  NOT NULL,
  "valorCampoEquipoId" INTEGER NOT NULL,
  "opcionId"           INTEGER NOT NULL,

  CONSTRAINT "valores_campo_opcion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "valores_campo_opcion_valorCampoEquipoId_opcionId_key"
  ON "valores_campo_opcion"("valorCampoEquipoId", "opcionId");
CREATE INDEX "valores_campo_opcion_opcionId_idx" ON "valores_campo_opcion"("opcionId");

-- ── 6. Incidencias ──────────────────────────────────────────────────
CREATE TABLE "incidencias" (
  "id"            SERIAL             NOT NULL,
  "codigo"        TEXT               NOT NULL,
  "equipoId"      INTEGER            NOT NULL,
  -- Texto libre: cada organización tiene su vocabulario y HVC todavía
  -- no fijó su catálogo.
  "tipo"          TEXT               NOT NULL,
  "prioridad"     TEXT,
  "descripcion"   TEXT               NOT NULL,
  "observacion"   TEXT,
  "recomendacion" TEXT,
  "responsableId" INTEGER,
  "estado"        "EstadoIncidencia" NOT NULL DEFAULT 'ABIERTA',
  "fechaCierre"   TIMESTAMP(3),
  "creadoPorId"   INTEGER,
  "creadoEn"      TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3)       NOT NULL,

  CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "incidencias_codigo_key" ON "incidencias"("codigo");
CREATE INDEX "incidencias_equipoId_estado_idx" ON "incidencias"("equipoId", "estado");
CREATE INDEX "incidencias_estado_creadoEn_idx" ON "incidencias"("estado", "creadoEn");

-- ── 7. Fotos: una tabla por dueño, sin capa polimórfica ─────────────
CREATE TABLE "fotos_equipo" (
  "id"             SERIAL       NOT NULL,
  "equipoId"       INTEGER      NOT NULL,
  "claveArchivo"   TEXT         NOT NULL,
  "claveMiniatura" TEXT,
  "nombreOriginal" TEXT,
  "subidaPorId"    INTEGER,
  "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fotos_equipo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fotos_equipo_equipoId_creadoEn_idx" ON "fotos_equipo"("equipoId", "creadoEn");

CREATE TABLE "fotos_incidencia" (
  "id"             SERIAL       NOT NULL,
  "incidenciaId"   INTEGER      NOT NULL,
  "claveArchivo"   TEXT         NOT NULL,
  "claveMiniatura" TEXT,
  "nombreOriginal" TEXT,
  "subidaPorId"    INTEGER,
  "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fotos_incidencia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fotos_incidencia_incidenciaId_creadoEn_idx"
  ON "fotos_incidencia"("incidenciaId", "creadoEn");

-- ── 8. Cotizaciones y órdenes de compra — PROVISIONAL ───────────────
-- Mínimo funcional hasta recibir el formato real de HVC. Las relaciones
-- son opcionales: una cotización puede existir sin incidencia, y una OC
-- puede no venir de una cotización.
CREATE TABLE "cotizaciones" (
  "id"             SERIAL             NOT NULL,
  "codigo"         TEXT               NOT NULL,
  "organizacionId" INTEGER            NOT NULL,
  "equipoId"       INTEGER,
  "incidenciaId"   INTEGER,
  "proveedor"      TEXT               NOT NULL,
  "monto"          DECIMAL(12,2)      NOT NULL,
  "estado"         "EstadoCotizacion" NOT NULL DEFAULT 'PENDIENTE',
  "claveDocumento" TEXT,
  "creadoPorId"    INTEGER,
  "creadoEn"       TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"  TIMESTAMP(3)       NOT NULL,

  CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cotizaciones_codigo_key" ON "cotizaciones"("codigo");
CREATE INDEX "cotizaciones_organizacionId_estado_idx" ON "cotizaciones"("organizacionId", "estado");
CREATE INDEX "cotizaciones_equipoId_idx"     ON "cotizaciones"("equipoId");
CREATE INDEX "cotizaciones_incidenciaId_idx" ON "cotizaciones"("incidenciaId");

CREATE TABLE "ordenes_compra" (
  "id"             SERIAL              NOT NULL,
  "codigo"         TEXT                NOT NULL,
  "organizacionId" INTEGER             NOT NULL,
  "cotizacionId"   INTEGER,
  "equipoId"       INTEGER,
  "incidenciaId"   INTEGER,
  "proveedor"      TEXT                NOT NULL,
  "monto"          DECIMAL(12,2)       NOT NULL,
  "estado"         "EstadoOrdenCompra" NOT NULL DEFAULT 'EMITIDA',
  "claveDocumento" TEXT,
  "creadoPorId"    INTEGER,
  "creadoEn"       TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"  TIMESTAMP(3)        NOT NULL,

  CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_compra_codigo_key" ON "ordenes_compra"("codigo");
CREATE INDEX "ordenes_compra_organizacionId_estado_idx" ON "ordenes_compra"("organizacionId", "estado");
CREATE INDEX "ordenes_compra_cotizacionId_idx" ON "ordenes_compra"("cotizacionId");

-- ── 9. Historial ────────────────────────────────────────────────────
CREATE TABLE "historial_equipos" (
  "id"            SERIAL                NOT NULL,
  "equipoId"      INTEGER,
  "incidenciaId"  INTEGER,
  "tipo"          "TipoEventoHistorial" NOT NULL,
  "usuarioId"     INTEGER,
  "campoAfectado" TEXT,
  "valorAnterior" TEXT,
  "valorNuevo"    TEXT,
  "descripcion"   TEXT,
  "creadoEn"      TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "historial_equipos_pkey" PRIMARY KEY ("id"),
  -- Un evento pertenece a UN equipo o a UNA incidencia, nunca a ambos
  -- ni a ninguno. Prisma no expresa CHECK, así que vive aquí.
  CONSTRAINT "historial_equipos_dueno_unico"
    CHECK (("equipoId" IS NULL) <> ("incidenciaId" IS NULL))
);

CREATE INDEX "historial_equipos_equipoId_creadoEn_idx"
  ON "historial_equipos"("equipoId", "creadoEn");
CREATE INDEX "historial_equipos_incidenciaId_creadoEn_idx"
  ON "historial_equipos"("incidenciaId", "creadoEn");

-- ── 10. Claves foráneas ─────────────────────────────────────────────
-- Restrict hacia arriba: no se borra una organización con equipos, ni
-- un nodo con equipos dentro. Cascade hacia abajo: borrar un equipo se
-- lleva sus valores, fotos e incidencias. SetNull en las opcionales y
-- en la autoría: dar de baja a un usuario no puede borrar un equipo ni
-- vaciar su historial.

ALTER TABLE "nodos_estructura"
  ADD CONSTRAINT "nodos_estructura_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "nodos_estructura"
  ADD CONSTRAINT "nodos_estructura_padreId_fkey"
  FOREIGN KEY ("padreId") REFERENCES "nodos_estructura"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "definiciones_campo"
  ADD CONSTRAINT "definiciones_campo_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "opciones_campo"
  ADD CONSTRAINT "opciones_campo_definicionCampoId_fkey"
  FOREIGN KEY ("definicionCampoId") REFERENCES "definiciones_campo"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipos"
  ADD CONSTRAINT "equipos_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipos"
  ADD CONSTRAINT "equipos_nodoId_fkey"
  FOREIGN KEY ("nodoId") REFERENCES "nodos_estructura"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipos"
  ADD CONSTRAINT "equipos_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "valores_campo"
  ADD CONSTRAINT "valores_campo_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "valores_campo"
  ADD CONSTRAINT "valores_campo_definicionCampoId_fkey"
  FOREIGN KEY ("definicionCampoId") REFERENCES "definiciones_campo"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "valores_campo"
  ADD CONSTRAINT "valores_campo_opcionId_fkey"
  FOREIGN KEY ("opcionId") REFERENCES "opciones_campo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "valores_campo_opcion"
  ADD CONSTRAINT "valores_campo_opcion_valorCampoEquipoId_fkey"
  FOREIGN KEY ("valorCampoEquipoId") REFERENCES "valores_campo"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "valores_campo_opcion"
  ADD CONSTRAINT "valores_campo_opcion_opcionId_fkey"
  FOREIGN KEY ("opcionId") REFERENCES "opciones_campo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incidencias"
  ADD CONSTRAINT "incidencias_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "incidencias"
  ADD CONSTRAINT "incidencias_responsableId_fkey"
  FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "incidencias"
  ADD CONSTRAINT "incidencias_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fotos_equipo"
  ADD CONSTRAINT "fotos_equipo_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fotos_equipo"
  ADD CONSTRAINT "fotos_equipo_subidaPorId_fkey"
  FOREIGN KEY ("subidaPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fotos_incidencia"
  ADD CONSTRAINT "fotos_incidencia_incidenciaId_fkey"
  FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fotos_incidencia"
  ADD CONSTRAINT "fotos_incidencia_subidaPorId_fkey"
  FOREIGN KEY ("subidaPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cotizaciones"
  ADD CONSTRAINT "cotizaciones_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cotizaciones"
  ADD CONSTRAINT "cotizaciones_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cotizaciones"
  ADD CONSTRAINT "cotizaciones_incidenciaId_fkey"
  FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cotizaciones"
  ADD CONSTRAINT "cotizaciones_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra"
  ADD CONSTRAINT "ordenes_compra_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra"
  ADD CONSTRAINT "ordenes_compra_cotizacionId_fkey"
  FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra"
  ADD CONSTRAINT "ordenes_compra_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra"
  ADD CONSTRAINT "ordenes_compra_incidenciaId_fkey"
  FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra"
  ADD CONSTRAINT "ordenes_compra_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "historial_equipos"
  ADD CONSTRAINT "historial_equipos_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "historial_equipos"
  ADD CONSTRAINT "historial_equipos_incidenciaId_fkey"
  FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "historial_equipos"
  ADD CONSTRAINT "historial_equipos_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
