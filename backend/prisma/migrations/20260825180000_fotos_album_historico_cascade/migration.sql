-- Complemento de la Fase 4: `albumes_fotos.carpetaId` pasa de RESTRICT a
-- CASCADE.
--
-- ⚠️ Ese `Restrict` era, sin que lo pareciera, **el candado que impedía
-- borrar una carpeta con fotos dentro**: como toda foto colgaba de un álbum y
-- todo álbum de una carpeta, la base rechazaba el borrado.
--
-- Con los álbumes retirados las filas que quedan son cascarones de solo
-- lectura —existen solo para que `comentarios_fotos.albumId` siga siendo
-- válido—, así que seguir bloqueando por ellas impediría borrar carpetas
-- vacías por un motivo que ya nadie puede ver ni resolver desde la interfaz.
--
-- La protección de verdad se mueve a `CarpetaService.eliminar`, que cuenta
-- las FOTOS del subárbol —las sueltas de cada ciclo y las de sus
-- actividades— y rechaza el borrado diciendo cuántas son. Es mejor candado
-- que el anterior: mide el contenido, no el envase.

ALTER TABLE "albumes_fotos" DROP CONSTRAINT "albumes_fotos_carpetaId_fkey";

ALTER TABLE "albumes_fotos" ADD CONSTRAINT "albumes_fotos_carpetaId_fkey"
  FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
