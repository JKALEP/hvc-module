import {
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { LIMITES } from './imagen.service';

/**
 * Traduce los cortes de multer al español.
 *
 * Multer aborta la petición ANTES de que el service vea los archivos, así
 * que las validaciones de `ImagenService` no llegan a ejecutarse ni para
 * el tamaño ni para el número de archivos. Y `@nestjs/platform-express`
 * ya convierte el `MulterError` en una excepción de Nest conservando su
 * texto, de modo que capturar `MulterError` aquí no sirve de nada: hay
 * que actuar sobre la excepción ya transformada.
 *
 * Sin esto, quien sube desde obra recibe "File too large" o
 * "Unexpected field - fotos", que ni dicen cuál es el límite ni están en
 * el idioma del resto del sistema.
 */

/** Textos que produce multer, con su reemplazo. */
const TRADUCCIONES: { coincide: (m: string) => boolean; texto: string }[] = [
  {
    coincide: (m) => m === 'File too large',
    texto:
      `Alguna de las fotos supera los ${LIMITES.bytesMaximos / 1024 / 1024} MB. ` +
      'Reduce su tamaño o súbela por separado.',
  },
  {
    // El "campo inesperado" es el archivo que sobra.
    coincide: (m) => m.includes('Unexpected field'),
    texto: `Máximo ${LIMITES.fotosPorSubida} fotos por subida. Envía el resto en otra tanda.`,
  },
  {
    coincide: (m) => m.includes('Too many files'),
    texto: `Máximo ${LIMITES.fotosPorSubida} fotos por subida. Envía el resto en otra tanda.`,
  },
];

/**
 * Solo estos dos tipos: son los que multer produce al cortar. Acotarlo
 * evita que la ruta se salte en silencio un futuro filtro global —de
 * logging o de formato uniforme de error—, que sí verá el resto
 * (403, 404, 500…) porque aquí ya ni se capturan.
 */
@Catch(PayloadTooLargeException, BadRequestException)
export class ErroresDeSubidaFilter implements ExceptionFilter {
  catch(excepcion: HttpException, host: ArgumentsHost) {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const estado = excepcion.getStatus();
    const cuerpo = excepcion.getResponse();

    const original =
      typeof cuerpo === 'string'
        ? cuerpo
        : ((cuerpo as { message?: unknown }).message ?? excepcion.message);
    const mensaje = typeof original === 'string' ? original : '';

    const traduccion = TRADUCCIONES.find((t) => t.coincide(mensaje));

    // Las nuestras siguen pasando por aquí —"el álbum está cerrado" o
    // "no se pudo subir ninguna foto" también son BadRequest— y se
    // reenvían tal cual.
    if (!traduccion) {
      respuesta
        .status(estado)
        .json(
          typeof cuerpo === 'string'
            ? { message: cuerpo, statusCode: estado }
            : cuerpo,
        );
      return;
    }

    respuesta.status(estado).json({
      message: traduccion.texto,
      error:
        excepcion instanceof PayloadTooLargeException
          ? 'Payload Too Large'
          : 'Bad Request',
      statusCode: estado,
    });
  }
}
