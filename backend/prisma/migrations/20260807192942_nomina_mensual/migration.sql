-- AlterTable
ALTER TABLE "trabajadores" ADD COLUMN     "estadoCivil" TEXT,
ADD COLUMN     "fechaNacimiento" DATE,
ADD COLUMN     "moneda" TEXT,
ADD COLUMN     "paisNacimiento" TEXT,
ADD COLUMN     "remuneracion" DECIMAL(12,2),
ADD COLUMN     "sede" TEXT,
ADD COLUMN     "sexo" TEXT,
ADD COLUMN     "tipoDocumento" TEXT,
ADD COLUMN     "tipoTrabajador" TEXT;

-- CreateTable
CREATE TABLE "nomina_mensual" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "trabajadorId" INTEGER NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "remuneracion" DECIMAL(12,2),
    "moneda" TEXT,
    "sede" TEXT,
    "observacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nomina_mensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nomina_mensual_anio_mes_empresaId_idx" ON "nomina_mensual"("anio", "mes", "empresaId");

-- CreateIndex
CREATE INDEX "nomina_mensual_trabajadorId_anio_mes_idx" ON "nomina_mensual"("trabajadorId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "nomina_mensual_anio_mes_trabajadorId_key" ON "nomina_mensual"("anio", "mes", "trabajadorId");

-- AddForeignKey
ALTER TABLE "nomina_mensual" ADD CONSTRAINT "nomina_mensual_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "trabajadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomina_mensual" ADD CONSTRAINT "nomina_mensual_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas_contratistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
