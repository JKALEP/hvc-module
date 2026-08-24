-- CreateEnum
CREATE TYPE "TipoCampoFotos" AS ENUM ('TEXTO', 'TEXTO_LARGO', 'NUMERO', 'FECHA', 'BOOLEANO', 'LISTA', 'FOTO');

-- CreateTable
CREATE TABLE "definiciones_campo_fotos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "tipo" "TipoCampoFotos" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "definiciones_campo_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opciones_campo_fotos" (
    "id" SERIAL NOT NULL,
    "definicionId" INTEGER NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opciones_campo_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valores_campo_fotos" (
    "id" SERIAL NOT NULL,
    "carpetaId" INTEGER NOT NULL,
    "definicionId" INTEGER NOT NULL,
    "valorTexto" TEXT,
    "valorNumero" DECIMAL(14,4),
    "valorFecha" DATE,
    "valorBooleano" BOOLEAN,
    "opcionId" INTEGER,
    "claveImagen" TEXT,
    "claveMiniatura" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "valores_campo_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "definiciones_campo_fotos_clave_key" ON "definiciones_campo_fotos"("clave");

-- CreateIndex
CREATE INDEX "definiciones_campo_fotos_orden_idx" ON "definiciones_campo_fotos"("orden");

-- CreateIndex
CREATE INDEX "opciones_campo_fotos_definicionId_orden_idx" ON "opciones_campo_fotos"("definicionId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "opciones_campo_fotos_definicionId_etiqueta_key" ON "opciones_campo_fotos"("definicionId", "etiqueta");

-- CreateIndex
CREATE INDEX "valores_campo_fotos_definicionId_valorTexto_idx" ON "valores_campo_fotos"("definicionId", "valorTexto");

-- CreateIndex
CREATE INDEX "valores_campo_fotos_definicionId_valorNumero_idx" ON "valores_campo_fotos"("definicionId", "valorNumero");

-- CreateIndex
CREATE INDEX "valores_campo_fotos_definicionId_valorFecha_idx" ON "valores_campo_fotos"("definicionId", "valorFecha");

-- CreateIndex
CREATE INDEX "valores_campo_fotos_definicionId_opcionId_idx" ON "valores_campo_fotos"("definicionId", "opcionId");

-- CreateIndex
CREATE UNIQUE INDEX "valores_campo_fotos_carpetaId_definicionId_key" ON "valores_campo_fotos"("carpetaId", "definicionId");

-- AddForeignKey
ALTER TABLE "opciones_campo_fotos" ADD CONSTRAINT "opciones_campo_fotos_definicionId_fkey" FOREIGN KEY ("definicionId") REFERENCES "definiciones_campo_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_campo_fotos" ADD CONSTRAINT "valores_campo_fotos_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_campo_fotos" ADD CONSTRAINT "valores_campo_fotos_definicionId_fkey" FOREIGN KEY ("definicionId") REFERENCES "definiciones_campo_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_campo_fotos" ADD CONSTRAINT "valores_campo_fotos_opcionId_fkey" FOREIGN KEY ("opcionId") REFERENCES "opciones_campo_fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
