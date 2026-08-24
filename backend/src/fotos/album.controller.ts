import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
  UseFilters,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AlbumService } from './album.service';
import type { ArchivoSubido } from './album.service';
import { LIMITES } from './imagen.service';
import { ErroresDeSubidaFilter } from './subida.filtro';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Álbumes y fotos.
 *
 * Vivía dentro de `CarpetaController` porque en v2 la galería era «las fotos
 * de esta carpeta» y no había álbum al que entrar. Con el álbum de vuelta
 * (§16) son dos recursos, dos services y dos ciclos de vida, y compartir
 * controller solo hacía que un archivo creciera con dos temas dentro.
 *
 * Los álbumes cuelgan de la carpeta en la URL —`carpeta/:id/album`— porque
 * es donde se crean y por donde se listan; las fotos van por su id, que es
 * como llegan los enlaces de descarga.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class AlbumController {
  constructor(private readonly album: AlbumService) {}

  /** Galería de la carpeta, paginada por álbum. */
  @Get('carpeta/:id/album')
  galeria(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
    @Query('subidaPorId', new ParseIntPipe({ optional: true }))
    subidaPorId?: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.album.galeria(usuario, id, {
      cursor,
      subidaPorId,
      desde,
      hasta,
    });
  }

  /** Quiénes han publicado aquí, para el filtro. */
  @Get('carpeta/:id/autores')
  autores(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.album.autores(usuario, id);
  }

  /**
   * Subir fotos. El álbum se crea solo, sin paso de «nombrar» nada (§17).
   * Multer las mantiene en memoria: nunca tocan el disco, que en Render es
   * efímero.
   */
  @Post('carpeta/:id/album')
  @UseFilters(ErroresDeSubidaFilter)
  @UseInterceptors(
    FilesInterceptor('fotos', LIMITES.fotosPorSubida, {
      limits: { fileSize: LIMITES.bytesMaximos },
    }),
  )
  subir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() archivos: ArchivoSubido[],
    @Body() dto: { descripcion?: string },
  ) {
    return this.album.subir(
      usuario,
      { tipo: 'carpeta', carpetaId: id },
      archivos,
      dto?.descripcion,
    );
  }

  // ── Álbumes con nombre (§16) ──

  @Post('album/carpeta/:id')
  crearAlbum(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
    @Body() dto: { nombre?: string; descripcion?: string; fecha?: string },
  ) {
    return this.album.crearAlbum(usuario, carpetaId, dto ?? {});
  }

  @Patch('album/:id')
  editarAlbum(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; descripcion?: string; fecha?: string },
  ) {
    return this.album.editarAlbum(usuario, id, dto ?? {});
  }

  /** Elimina un álbum vacío (§16). Con fotos dentro se rechaza con 400. */
  @Delete('album/:id')
  eliminarAlbum(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.album.eliminarAlbum(usuario, id);
  }

  /** Subir a un álbum que YA existe (§16). */
  @Post('album/:id/foto')
  @UseFilters(ErroresDeSubidaFilter)
  @UseInterceptors(
    FilesInterceptor('fotos', LIMITES.fotosPorSubida, {
      limits: { fileSize: LIMITES.bytesMaximos },
    }),
  )
  subirAAlbum(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) albumId: number,
    @UploadedFiles() archivos: ArchivoSubido[],
    @Body() dto: { descripcion?: string },
  ) {
    return this.album.subir(
      usuario,
      { tipo: 'album', albumId },
      archivos,
      dto?.descripcion,
    );
  }

  /** Fotos de una tarea (§15: «tarea relacionada»). */
  @Post('tarea/:id/foto')
  @UseFilters(ErroresDeSubidaFilter)
  @UseInterceptors(
    FilesInterceptor('fotos', LIMITES.fotosPorSubida, {
      limits: { fileSize: LIMITES.bytesMaximos },
    }),
  )
  subirATarea(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) tareaId: number,
    @UploadedFiles() archivos: ArchivoSubido[],
    @Body() dto: { descripcion?: string },
  ) {
    return this.album.subir(
      usuario,
      { tipo: 'tarea', tareaId },
      archivos,
      dto?.descripcion,
    );
  }

  // ── Bandeja de pendientes (§17, §18) ──

  /**
   * «Subir fotos sin asignar» (§17). No lleva id en la ruta porque no hay
   * destino: la bandeja es siempre la de quien sube.
   */
  @Post('bandeja')
  @UseFilters(ErroresDeSubidaFilter)
  @UseInterceptors(
    FilesInterceptor('fotos', LIMITES.fotosPorSubida, {
      limits: { fileSize: LIMITES.bytesMaximos },
    }),
  )
  subirSinAsignar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @UploadedFiles() archivos: ArchivoSubido[],
    @Body() dto: { descripcion?: string },
  ) {
    return this.album.subir(
      usuario,
      { tipo: 'bandeja' },
      archivos,
      dto?.descripcion,
    );
  }

  @Get('bandeja')
  bandeja(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.album.bandeja(usuario);
  }

  /** Clasificar por lotes (§18). El destino llega en el cuerpo. */
  @Post('bandeja/clasificar')
  clasificar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body()
    dto: {
      fotoIds?: number[];
      carpetaId?: number;
      albumId?: number;
      tareaId?: number;
      /** Para el álbum que se crea al clasificar en una carpeta (Fase 2c). */
      nombre?: unknown;
      descripcion?: unknown;
    },
  ) {
    // El cuerpo llega con ids sueltos —es lo natural en JSON— y aquí se
    // convierte en el destino tipado que el service exige. Traducir en la
    // frontera evita que la unión se contamine con opcionales.
    const destino =
      dto?.tareaId !== undefined
        ? ({ tipo: 'tarea', tareaId: Number(dto.tareaId) } as const)
        : dto?.albumId !== undefined
          ? ({ tipo: 'album', albumId: Number(dto.albumId) } as const)
          : dto?.carpetaId !== undefined
            ? ({ tipo: 'carpeta', carpetaId: Number(dto.carpetaId) } as const)
            : null;

    if (!destino)
      throw new BadRequestException(
        'Indica a dónde van las fotos: una tarea, un álbum o una carpeta.',
      );

    return this.album.clasificar(usuario, dto?.fotoIds ?? [], destino, {
      nombre: dto?.nombre,
      descripcion: dto?.descripcion,
    });
  }

  @Get('foto/:fotoId/descarga')
  descargar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.album.urlDeDescarga(usuario, fotoId);
  }

  /** Borra quien la subió (EDICION) o quien administra la carpeta (TOTAL). */
  /**
   * Corregir la descripción de una foto ya subida.
   *
   * `PATCH` de un solo campo y no un `PUT` del recurso: es lo ÚNICO que se
   * puede cambiar de una foto. La imagen no se reemplaza —eso permitiría
   * cambiar la prueba de una inspección sin que se note—, y su sitio se
   * mueve por otra ruta.
   */
  @Patch('foto/:fotoId')
  editarFoto(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('fotoId', ParseIntPipe) fotoId: number,
    @Body() dto: { descripcion?: unknown },
  ) {
    return this.album.editarDescripcion(usuario, fotoId, dto?.descripcion);
  }

  /**
   * Mover una foto (§1.2 de gestión de contenido).
   *
   * El destino llega igual que en `clasificar` —ids sueltos que aquí se
   * traducen a la unión tipada—, y admite además `bandeja: true` para
   * devolverla a «sin clasificar». Se exige EDICION en origen Y en destino;
   * lo decide el service.
   */
  @Post('foto/:fotoId/mover')
  moverFoto(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('fotoId', ParseIntPipe) fotoId: number,
    @Body()
    dto: {
      carpetaId?: number;
      albumId?: number;
      tareaId?: number;
      bandeja?: boolean;
    },
  ) {
    const destino =
      dto?.bandeja === true
        ? ({ tipo: 'bandeja' } as const)
        : dto?.tareaId !== undefined
          ? ({ tipo: 'tarea', tareaId: Number(dto.tareaId) } as const)
          : dto?.albumId !== undefined
            ? ({ tipo: 'album', albumId: Number(dto.albumId) } as const)
            : dto?.carpetaId !== undefined
              ? ({ tipo: 'carpeta', carpetaId: Number(dto.carpetaId) } as const)
              : null;

    if (!destino)
      throw new BadRequestException(
        'Indica a dónde va la foto: una tarea, un álbum, una carpeta, o «sin clasificar».',
      );

    return this.album.mover(usuario, fotoId, destino);
  }

  @Delete('foto/:fotoId')
  eliminarFoto(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.album.eliminar(usuario, fotoId);
  }
}
