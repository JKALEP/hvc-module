import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Almacenamiento de fotos en Cloudflare R2.
 *
 * NO se usa el disco local: en Render el filesystem es efímero y cada
 * deploy arranca un contenedor nuevo, así que las fotos subidas se
 * perderían. R2 se eligió sobre S3 por el egreso gratuito — una galería
 * se lee muchas más veces de las que se escribe.
 *
 * El bucket es PRIVADO. Las fotos se sirven con URLs firmadas de
 * vencimiento corto: si el bucket fuera público, cualquiera con el enlace
 * vería la foto para siempre.
 *
 * Al ser R2 compatible con S3, migrar a S3 o MinIO sería cambiar el
 * endpoint, no el código.
 */

/** Vida de una URL firmada. Suficiente para cargar una galería y volver. */
const VIGENCIA_URL_SEGUNDOS = 60 * 60; // 1 h

@Injectable()
export class AlmacenamientoService {
  private readonly log = new Logger(AlmacenamientoService.name);
  private cliente: S3Client | null = null;
  private readonly bucket = process.env.R2_BUCKET ?? '';

  /**
   * Cliente perezoso: el módulo debe poder arrancar sin R2 configurado
   * (el resto del sistema no depende de fotos). Solo falla al intentar
   * usarlo, y con un mensaje que dice exactamente qué falta.
   */
  private obtenerCliente(): S3Client {
    if (this.cliente) return this.cliente;

    const cuenta = process.env.R2_ACCOUNT_ID;
    const clave = process.env.R2_ACCESS_KEY_ID;
    const secreto = process.env.R2_SECRET_ACCESS_KEY;

    const faltantes = [
      !cuenta && 'R2_ACCOUNT_ID',
      !clave && 'R2_ACCESS_KEY_ID',
      !secreto && 'R2_SECRET_ACCESS_KEY',
      !this.bucket && 'R2_BUCKET',
    ].filter(Boolean);

    if (faltantes.length > 0)
      throw new InternalServerErrorException(
        `El almacenamiento de fotos no está configurado. Faltan variables de entorno: ${faltantes.join(', ')}.`,
      );

    this.cliente = new S3Client({
      // R2 ignora la región, pero el SDK de S3 exige uno.
      region: 'auto',
      endpoint:
        process.env.R2_ENDPOINT ?? `https://${cuenta}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: clave as string,
        secretAccessKey: secreto as string,
      },
    });
    return this.cliente;
  }

  /** ¿Se puede subir? Lo usa el controller para avisar antes de procesar. */
  get configurado(): boolean {
    return Boolean(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
    );
  }

  /**
   * Clave de un objeto. Se agrupa para que el bucket sea navegable y borrar
   * un grupo entero sea un prefijo.
   *
   * `grupo` es el id del álbum cuando la foto tiene uno, y `u<usuarioId>`
   * cuando no —las de una tarea y las de la bandeja de §18—. Admite texto
   * desde la Fase 6 por eso: es lo ÚNICO que cambió aquí.
   *
   * ⚠️ El prefijo sigue siendo `lotes/` aunque el modelo ya no tenga lotes.
   * Cambiarlo no rompería nada —la clave se guarda por foto en la BD, así
   * que los objetos viejos se seguirían sirviendo— pero partiría el bucket
   * en dos prefijos para siempre a cambio de nada. Lo mismo valió para
   * `albumes/`, de antes de v2, que también sigue ahí.
   */
  construirClave(
    grupo: number | string,
    nombre: string,
    variante: 'img' | 'thumb',
  ) {
    return `lotes/${grupo}/${variante}/${nombre}`;
  }

  async subir(clave: string, contenido: Buffer, tipoMime: string) {
    await this.obtenerCliente().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        Body: contenido,
        ContentType: tipoMime,
      }),
    );
    return clave;
  }

  /** URL temporal de lectura. */
  async urlFirmada(clave: string): Promise<string> {
    return getSignedUrl(
      this.obtenerCliente(),
      new GetObjectCommand({ Bucket: this.bucket, Key: clave }),
      { expiresIn: VIGENCIA_URL_SEGUNDOS },
    );
  }

  /**
   * URL temporal que el navegador GUARDA en vez de abrir.
   *
   * El `Content-Disposition` se pide en la firma, así que lo impone R2 al
   * responder: no depende de que el enlace lleve un atributo `download`,
   * que además no funciona entre dominios distintos.
   */
  async urlDeDescarga(clave: string, nombreArchivo: string): Promise<string> {
    return getSignedUrl(
      this.obtenerCliente(),
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        ResponseContentDisposition: `attachment; filename="${nombreArchivo.replace(/"/g, '')}"`,
      }),
      { expiresIn: VIGENCIA_URL_SEGUNDOS },
    );
  }

  /**
   * Borra varios objetos de una vez.
   *
   * Un fallo aquí NO se propaga: si el objeto ya no está o R2 no responde,
   * lo importante —que la fila desaparezca de la BD— ya ocurrió. Se
   * registra para poder limpiar huérfanos después; hacer fallar el borrado
   * lógico por un archivo perdido sería peor.
   */
  async borrar(claves: string[]) {
    if (claves.length === 0) return;
    try {
      await this.obtenerCliente().send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: claves.map((Key) => ({ Key })) },
        }),
      );
    } catch (error) {
      this.log.warn(
        `No se pudieron borrar ${claves.length} objeto(s) de R2: ${
          error instanceof Error ? error.message : String(error)
        }. Quedan huérfanos: ${claves.join(', ')}`,
      );
    }
  }
}
