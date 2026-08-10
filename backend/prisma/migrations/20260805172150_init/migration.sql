-- CreateEnum
CREATE TYPE "Estado" AS ENUM ('COMPLETO', 'INCOMPLETO');

-- CreateTable
CREATE TABLE "importaciones" (
    "id" SERIAL NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "fechaImportacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalFilas" INTEGER NOT NULL DEFAULT 0,
    "filasCompletas" INTEGER NOT NULL DEFAULT 0,
    "estado" "Estado" NOT NULL DEFAULT 'INCOMPLETO',

    CONSTRAINT "importaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "importacionId" INTEGER NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidadMedida" TEXT,
    "cantidad" DECIMAL(14,4),
    "detalles" TEXT,
    "referencias" TEXT,
    "precioUnitario" DECIMAL(14,4),
    "proveedor" TEXT,
    "ruc" TEXT,
    "estado" "Estado" NOT NULL DEFAULT 'INCOMPLETO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_precios" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "precioAnterior" DECIMAL(14,4),
    "precioNuevo" DECIMAL(14,4) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_precios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "productos_importacionId_idx" ON "productos"("importacionId");

-- CreateIndex
CREATE INDEX "productos_codigo_idx" ON "productos"("codigo");

-- CreateIndex
CREATE INDEX "productos_proveedor_idx" ON "productos"("proveedor");

-- CreateIndex
CREATE INDEX "productos_ruc_idx" ON "productos"("ruc");

-- CreateIndex
CREATE INDEX "historial_precios_productoId_idx" ON "historial_precios"("productoId");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "importaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_precios" ADD CONSTRAINT "historial_precios_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
