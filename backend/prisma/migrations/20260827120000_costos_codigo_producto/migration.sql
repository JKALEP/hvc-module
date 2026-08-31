-- Código de producto en el ítem del requerimiento, y su copia en el costo.
--
-- Nace del formulario de «Añadir ítem»: hasta ahora el número de parte se
-- escribía dentro de `referencias`, junto a la marca y el modelo, y por eso
-- no se podía buscar por él. Se separa en columna propia.
--
-- ADD COLUMN nullable, sin DEFAULT: es aditivo puro. Las filas que ya
-- existen quedan en NULL, que es la verdad —nadie les puso código— y no un
-- valor inventado. Nada que reescribir, ningún backfill.
--
-- `costos_costo_items` lo recibe también porque es el SNAPSHOT del ítem al
-- registrar el costo: sin la columna, la Base de Costos no podría decir
-- contra qué código se pagó ese precio.

ALTER TABLE "costos_requerimiento_items" ADD COLUMN "codigoProducto" TEXT;

ALTER TABLE "costos_costo_items" ADD COLUMN "codigoProducto" TEXT;
