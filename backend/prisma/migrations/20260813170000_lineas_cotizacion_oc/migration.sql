-- Cotizaciones y órdenes de compra como DATOS EDITABLES.
--
-- Se retiran dos columnas y se añaden dos tablas de líneas.
--
-- `claveDocumento` desaparece porque el flujo es 100 % datos en la web:
-- no se adjunta el PDF ni el Excel del proveedor como archivo aparte.
-- El documento se arma en pantalla y los botones de exportar generan el
-- archivo en el momento, sin guardar nada.
--
-- `monto` desaparece porque pasa a ser la suma de las líneas, calculada
-- en lectura. Guardarlo sería guardar un cálculo: habría que
-- reescribirlo al crear, editar y borrar cada línea, y el día que uno de
-- esos caminos fallara el total mentiría. Mismo criterio que el avance
-- del proyecto y el estado de la obra.
--
-- Sin pérdida de datos reales: las dos tablas están vacías (el módulo
-- todavía no tiene cotizaciones ni órdenes cargadas).
--
-- Verificar después de aplicar:
--   SELECT count(*) FROM equipos;       -- sin cambios
--   SELECT count(*) FROM incidencias;   -- sin cambios

-- ── 1. Fuera lo que ya no aplica ────────────────────────────────────
ALTER TABLE "cotizaciones"   DROP COLUMN IF EXISTS "claveDocumento";
ALTER TABLE "cotizaciones"   DROP COLUMN IF EXISTS "monto";
ALTER TABLE "ordenes_compra" DROP COLUMN IF EXISTS "claveDocumento";
ALTER TABLE "ordenes_compra" DROP COLUMN IF EXISTS "monto";

-- ── 2. Líneas ───────────────────────────────────────────────────────
-- Dos tablas y no una polimórfica: mismo criterio que las fotos de este
-- módulo. `subtotal` no es columna — es cantidad × precioUnitario y se
-- calcula en lectura, igual que el total del documento.

CREATE TABLE "lineas_cotizacion" (
  "id"             SERIAL        NOT NULL,
  "cotizacionId"   INTEGER       NOT NULL,
  "orden"          INTEGER       NOT NULL DEFAULT 0,
  "descripcion"    TEXT          NOT NULL,
  "cantidad"       DECIMAL(14,4) NOT NULL,
  "precioUnitario" DECIMAL(14,4) NOT NULL,
  "creadoEn"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"  TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "lineas_cotizacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lineas_cotizacion_cotizacionId_orden_idx"
  ON "lineas_cotizacion"("cotizacionId", "orden");

CREATE TABLE "lineas_orden_compra" (
  "id"             SERIAL        NOT NULL,
  "ordenCompraId"  INTEGER       NOT NULL,
  "orden"          INTEGER       NOT NULL DEFAULT 0,
  "descripcion"    TEXT          NOT NULL,
  "cantidad"       DECIMAL(14,4) NOT NULL,
  "precioUnitario" DECIMAL(14,4) NOT NULL,
  "creadoEn"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"  TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "lineas_orden_compra_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lineas_orden_compra_ordenCompraId_orden_idx"
  ON "lineas_orden_compra"("ordenCompraId", "orden");

-- ── 3. Claves foráneas ──────────────────────────────────────────────
-- Cascade: una línea no tiene sentido sin su documento.

ALTER TABLE "lineas_cotizacion"
  ADD CONSTRAINT "lineas_cotizacion_cotizacionId_fkey"
  FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lineas_orden_compra"
  ADD CONSTRAINT "lineas_orden_compra_ordenCompraId_fkey"
  FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
