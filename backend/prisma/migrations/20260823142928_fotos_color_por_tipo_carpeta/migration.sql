-- CreateEnum
CREATE TYPE "ColorCarpetaFotos" AS ENUM ('AMARILLO', 'CELESTE');

-- CreateTable
CREATE TABLE "configuracion_color_carpeta" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoCarpetaFotos" NOT NULL,
    "color" "ColorCarpetaFotos" NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_color_carpeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_color_carpeta_tipo_key" ON "configuracion_color_carpeta"("tipo");

-- Los dos valores por defecto que pidió HVC: carpeta normal amarilla,
-- equipo celeste.
--
-- Se siembran AQUÍ y no en el código a propósito: el requerimiento es que el
-- color sea un dato configurable, no una constante. Si el defecto viviera
-- como literal en un service, cambiarlo desde la pantalla de administración
-- dejaría dos verdades —la fila y el literal— y la primera vez que la tabla
-- se vaciara volvería el color viejo sin que nadie lo pidiera.
--
-- `ON CONFLICT DO NOTHING` sobre la única de `tipo`: la migración es
-- idempotente y no pisa una elección que el administrador ya haya hecho.
INSERT INTO "configuracion_color_carpeta" ("tipo", "color", "actualizadoEn")
VALUES ('CARPETA', 'AMARILLO', NOW()),
       ('EQUIPO',  'CELESTE',  NOW())
ON CONFLICT ("tipo") DO NOTHING;
