import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Procesado de imágenes con sharp.
 *
 * NUNCA se guarda el archivo original: una foto de móvil son 3–8 MB y
 * multiplicados por miles de jornadas se come el almacenamiento sin dar
 * nada a cambio — a 1600 px ya se lee una placa o un número de serie.
 */

/** Lo que se acepta de entrada. HEIC es lo que produce un iPhone por defecto. */
export const MIME_ACEPTADOS = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
] as const;

export const LIMITES = {
  /** Por archivo. Una foto de móvil moderno cabe de sobra; un RAW no. */
  bytesMaximos: 15 * 1024 * 1024,
  /** El supervisor sube la jornada de una vez, no de una en una. */
  fotosPorSubida: 15,
  /** Lado mayor de la imagen que se sirve. */
  anchoMaximo: 1600,
  calidad: 80,
  /** Lado mayor de la miniatura de galería. */
  anchoMiniatura: 400,
  calidadMiniatura: 70,
} as const;

export interface ImagenProcesada {
  imagen: Buffer;
  miniatura: Buffer;
  anchoPx: number;
  altoPx: number;
  bytes: number;
  bytesOriginal: number;
  formato: 'webp';
  tomadaEn: Date | null;
}

@Injectable()
export class ImagenService {
  /**
   * Fecha de captura del EXIF, si viene.
   *
   * El formato EXIF es "AAAA:MM:DD HH:MM:SS" — con dos puntos también en
   * la fecha, que `new Date()` no entiende. Se parsea a mano.
   */
  private fechaExif(exif: Buffer | undefined): Date | null {
    if (!exif) return null;
    const texto = exif.toString('latin1');
    const m = /(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/.exec(texto);
    if (!m) return null;
    const fecha = new Date(
      Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
    );
    return isNaN(fecha.getTime()) ? null : fecha;
  }

  /** Valida el archivo antes de gastar CPU en procesarlo. */
  validar(archivo: { mimetype: string; size: number; originalname: string }) {
    if (
      !MIME_ACEPTADOS.includes(
        archivo.mimetype as (typeof MIME_ACEPTADOS)[number],
      )
    )
      throw new BadRequestException(
        `"${archivo.originalname}" no es un formato aceptado (${archivo.mimetype}). ` +
          'Se admiten JPEG, PNG, HEIC y WebP.',
      );
    if (archivo.size > LIMITES.bytesMaximos)
      throw new BadRequestException(
        `"${archivo.originalname}" pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB ` +
          `y el máximo son ${LIMITES.bytesMaximos / 1024 / 1024} MB.`,
      );
  }

  /**
   * Redimensiona a WebP y genera la miniatura.
   *
   * `.rotate()` sin argumentos aplica la orientación del EXIF y luego la
   * descarta: sin esto, las fotos verticales de móvil salen tumbadas.
   *
   * Los metadatos NO se copian a la salida (sharp los descarta por
   * defecto): el EXIF de un móvil lleva coordenadas GPS y modelo de
   * dispositivo, que no tienen por qué viajar con una foto de obra.
   */
  async procesar(archivo: {
    buffer: Buffer;
    mimetype: string;
    size: number;
    originalname: string;
  }): Promise<ImagenProcesada> {
    this.validar(archivo);

    let meta: sharp.Metadata;
    try {
      meta = await sharp(archivo.buffer).metadata();
    } catch {
      throw new BadRequestException(
        `"${archivo.originalname}" no se pudo leer como imagen. ¿Está corrupto?`,
      );
    }

    const base = sharp(archivo.buffer).rotate();

    const imagen = await base
      .clone()
      .resize({
        width: LIMITES.anchoMaximo,
        height: LIMITES.anchoMaximo,
        fit: 'inside',
        // No agrandar una foto pequeña: solo añadiría peso sin detalle.
        withoutEnlargement: true,
      })
      .webp({ quality: LIMITES.calidad })
      .toBuffer({ resolveWithObject: true });

    const miniatura = await base
      .clone()
      .resize({
        width: LIMITES.anchoMiniatura,
        height: LIMITES.anchoMiniatura,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: LIMITES.calidadMiniatura })
      .toBuffer();

    return {
      imagen: imagen.data,
      miniatura,
      anchoPx: imagen.info.width,
      altoPx: imagen.info.height,
      bytes: imagen.data.length,
      bytesOriginal: archivo.size,
      formato: 'webp',
      tomadaEn: this.fechaExif(meta.exif),
    };
  }
}
