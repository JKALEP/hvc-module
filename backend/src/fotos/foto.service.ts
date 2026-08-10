import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AlmacenamientoService } from './almacenamiento.service';
import { ImagenService, LIMITES } from './imagen.service';
import { AlbumService } from './album.service';
import { claveDia } from '../common/fechas';
import type { UsuarioAutenticado } from '../auth/tipos';

export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly imagen: ImagenService,
    private readonly album: AlbumService,
  ) {}

  private limpiar(valor: unknown): string | null {
    if (typeof valor !== 'string') return null;
    const s = valor.trim();
    return s === '' ? null : s;
  }

  /**
   * Feed del álbum, en orden cronológico inverso.
   *
   * Cada foto trae su URL firmada: el bucket es privado, así que sin
   * firmar no se puede mostrar nada. Se firman en paralelo porque son
   * operaciones locales (no van a la red).
   */
  async feed(
    usuario: UsuarioAutenticado,
    albumId: number,
    filtros: { subidaPorId?: number; desde?: string; hasta?: string },
    // `anonimo`: a un cliente externo no se le enseña qué persona de HVC
    // subió cada foto. El dato existe, pero no es suyo.
    opciones: { anonimo?: boolean } = {},
  ) {
    const album = await this.album.obtenerConAcceso(usuario, albumId);

    const fotos = await this.prisma.foto.findMany({
      where: {
        albumId,
        ...(filtros.subidaPorId !== undefined
          ? { subidaPorId: filtros.subidaPorId }
          : {}),
        ...(filtros.desde || filtros.hasta
          ? {
              creadoEn: {
                ...(filtros.desde
                  ? { gte: new Date(`${filtros.desde}T00:00:00.000Z`) }
                  : {}),
                // Hasta el final del día, no su medianoche.
                ...(filtros.hasta
                  ? { lte: new Date(`${filtros.hasta}T23:59:59.999Z`) }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: { creadoEn: 'desc' },
      select: {
        id: true,
        descripcion: true,
        claveImagen: true,
        claveMiniatura: true,
        anchoPx: true,
        altoPx: true,
        bytes: true,
        tomadaEn: true,
        creadoEn: true,
        subidaPor: { select: { id: true, nombre: true } },
      },
    });

    const conUrls = await Promise.all(
      fotos.map(async (f) => ({
        id: f.id,
        descripcion: f.descripcion,
        anchoPx: f.anchoPx,
        altoPx: f.altoPx,
        bytes: f.bytes,
        tomadaEn: f.tomadaEn ? claveDia(f.tomadaEn) : null,
        creadoEn: f.creadoEn,
        // Quién la subió: con dos roles publicando en el mismo hilo, sin
        // el autor visible el feed pierde sentido — salvo para un cliente.
        subidaPor: opciones.anonimo ? null : f.subidaPor,
        url: await this.almacenamiento.urlFirmada(f.claveImagen),
        urlMiniatura: await this.almacenamiento.urlFirmada(f.claveMiniatura),
      })),
    );

    return {
      album,
      // El frontend lo usa para decidir si muestra el formulario de
      // subida. Un cliente externo nunca sube, esté abierto o no.
      puedeSubir: album.estado === 'ABIERTO' && !opciones.anonimo,
      total: conUrls.length,
      fotos: conUrls,
    };
  }

  /**
   * URL de descarga de una foto concreta.
   *
   * Se comprueba el acceso al álbum igual que en el feed: que la firma
   * caduque no sustituye a comprobar quién pide.
   */
  async urlDeDescarga(
    usuario: UsuarioAutenticado,
    albumId: number,
    fotoId: number,
  ) {
    const album = await this.album.obtenerConAcceso(usuario, albumId);

    const foto = await this.prisma.foto.findFirst({
      where: { id: fotoId, albumId },
      select: { id: true, claveImagen: true, creadoEn: true },
    });
    if (!foto)
      throw new NotFoundException(
        `Foto ${fotoId} no encontrada en este álbum.`,
      );

    // Nombre legible en la carpeta de descargas del cliente, no un uuid.
    const nombre = `${album.nombre} - ${claveDia(foto.creadoEn)} - ${foto.id}.webp`;
    return {
      url: await this.almacenamiento.urlDeDescarga(foto.claveImagen, nombre),
      nombreArchivo: nombre,
    };
  }

  /** Quiénes han publicado en este álbum, para el filtro del feed. */
  async autores(usuario: UsuarioAutenticado, albumId: number) {
    await this.album.obtenerConAcceso(usuario, albumId);
    const filas = await this.prisma.foto.groupBy({
      by: ['subidaPorId'],
      where: { albumId },
      _count: { _all: true },
    });
    if (filas.length === 0) return [];

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: filas.map((f) => f.subidaPorId) } },
      select: { id: true, nombre: true },
    });
    const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));

    return filas
      .map((f) => ({
        usuarioId: f.subidaPorId,
        nombre: nombres.get(f.subidaPorId) ?? '—',
        fotos: f._count._all,
      }))
      .sort((a, b) => b.fotos - a.fotos);
  }

  /**
   * Sube una o varias fotos.
   *
   * Cada archivo se procesa y se sube por separado; si uno falla, los
   * anteriores ya guardados se conservan. Es lo correcto para una subida
   * desde obra con mala señal: perder las 9 buenas porque la 10ª estaba
   * corrupta sería peor que informar del fallo parcial.
   */
  async subir(
    usuario: UsuarioAutenticado,
    albumId: number,
    archivos: ArchivoSubido[],
    descripcion?: string | null,
  ) {
    const album = await this.album.obtenerConAcceso(usuario, albumId);
    this.album.exigirAbierto(album);

    if (!archivos || archivos.length === 0)
      throw new BadRequestException('No se recibió ninguna imagen.');
    if (archivos.length > LIMITES.fotosPorSubida)
      throw new BadRequestException(
        `Máximo ${LIMITES.fotosPorSubida} fotos por subida. Recibidas: ${archivos.length}.`,
      );
    if (!this.almacenamiento.configurado)
      throw new BadRequestException(
        'El almacenamiento de fotos no está configurado en el servidor. Avisa al administrador.',
      );

    const texto = this.limpiar(descripcion);
    const guardadas: { id: number; bytes: number; bytesOriginal: number }[] =
      [];
    const fallidas: { archivo: string; motivo: string }[] = [];

    for (const archivo of archivos) {
      try {
        const procesada = await this.imagen.procesar(archivo);

        // Nombre aleatorio: el original puede repetirse ("IMG_0001.jpg"
        // en diez móviles distintos) y además puede traer caracteres raros.
        const base = `${Date.now()}-${randomUUID()}.webp`;
        const claveImagen = this.almacenamiento.construirClave(
          albumId,
          base,
          'img',
        );
        const claveMiniatura = this.almacenamiento.construirClave(
          albumId,
          base,
          'thumb',
        );

        await this.almacenamiento.subir(
          claveImagen,
          procesada.imagen,
          'image/webp',
        );
        await this.almacenamiento.subir(
          claveMiniatura,
          procesada.miniatura,
          'image/webp',
        );

        const foto = await this.prisma.foto.create({
          data: {
            albumId,
            descripcion: texto,
            subidaPorId: usuario.id,
            claveImagen,
            claveMiniatura,
            anchoPx: procesada.anchoPx,
            altoPx: procesada.altoPx,
            bytes: procesada.bytes,
            bytesOriginal: procesada.bytesOriginal,
            formato: procesada.formato,
            tomadaEn: procesada.tomadaEn,
          },
          select: { id: true, bytes: true, bytesOriginal: true },
        });
        guardadas.push(foto);
      } catch (error) {
        fallidas.push({
          archivo: archivo.originalname,
          motivo: error instanceof Error ? error.message : 'Error desconocido.',
        });
      }
    }

    if (guardadas.length === 0)
      throw new BadRequestException(
        `No se pudo subir ninguna foto. ${fallidas.map((f) => `${f.archivo}: ${f.motivo}`).join(' · ')}`,
      );

    // Toca el álbum para que suba en el listado por actividad reciente.
    await this.prisma.albumFotos.update({
      where: { id: albumId },
      data: { actualizadoEn: new Date() },
    });

    return {
      subidas: guardadas.length,
      fallidas,
      bytesGuardados: guardadas.reduce((a, f) => a + f.bytes, 0),
      bytesOriginales: guardadas.reduce((a, f) => a + f.bytesOriginal, 0),
    };
  }

  /**
   * Borra una foto. Puede hacerlo quien la subió o un ADMIN_FOTOS.
   * Primero la fila, luego los objetos: si R2 falla, queda un huérfano
   * registrado en el log, no una foto fantasma en el feed.
   */
  async eliminar(usuario: UsuarioAutenticado, albumId: number, fotoId: number) {
    await this.album.obtenerConAcceso(usuario, albumId);

    const foto = await this.prisma.foto.findFirst({
      where: { id: fotoId, albumId },
      select: {
        id: true,
        subidaPorId: true,
        claveImagen: true,
        claveMiniatura: true,
      },
    });
    if (!foto)
      throw new NotFoundException(
        `Foto ${fotoId} no encontrada en el álbum ${albumId}.`,
      );

    const esAutor = foto.subidaPorId === usuario.id;
    if (!esAutor && !this.album.esAdminFotos(usuario))
      throw new ForbiddenException(
        'Solo quien subió la foto o un administrador de Fotos puede eliminarla.',
      );

    await this.prisma.foto.delete({ where: { id: fotoId } });
    await this.almacenamiento.borrar([foto.claveImagen, foto.claveMiniatura]);

    return { ok: true, id: fotoId };
  }
}
