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
import { FotoService } from './foto.service';
import type { ArchivoSubido } from './foto.service';
import { LIMITES } from './imagen.service';
import { ErroresDeSubidaFilter } from './subida.filtro';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Las fotos.
 *
 * ⚠️ Se llamaba «Álbumes y fotos» y ya no hay álbumes (Fase 4). La galería
 * volvió a ser una lista plana, pero colgando de la INTERVENCIÓN y no de la carpeta:
 * agrupar por intervención es lo que HVC pregunta, y el álbum era un segundo
 * agrupador que obligaba a elegir dónde mirar.
 *
 * Las fotos van por su id —que es como llegan los enlaces de descarga— y lo
 * que las agrupa va en la URL: `intervencion/:id/foto` o `actividad/:id/foto`.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class FotoController {
  constructor(private readonly fotos: FotoService) {}

  /** Las fotos sueltas de una intervención, paginadas. */
  @Get('intervencion/:id/foto')
  galeria(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
    @Query('subidaPorId', new ParseIntPipe({ optional: true }))
    subidaPorId?: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.fotos.galeria(usuario, id, {
      cursor,
      subidaPorId,
      desde,
      hasta,
    });
  }

  /** Quiénes han subido fotos a esta intervención, para el filtro. */
  @Get('intervencion/:id/autores')
  autores(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.fotos.autores(usuario, id);
  }

  /**
   * Subir fotos sueltas a la intervención.
   *
   * Sin paso de «nombrar» nada (§17): con los álbumes retirados no hay
   * agrupación que inventar, la foto entra directamente en la intervención. Multer
   * las mantiene en memoria: nunca tocan el disco, que en Render es efímero.
   */
  @Post('intervencion/:id/foto')
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
    return this.fotos.subir(
      usuario,
      { tipo: 'intervencion', intervencionId: id },
      archivos,
      dto?.descripcion,
    );
  }

  /** Fotos de una actividad (§15: «actividad relacionada»). */
  @Post('actividad/:id/foto')
  @UseFilters(ErroresDeSubidaFilter)
  @UseInterceptors(
    FilesInterceptor('fotos', LIMITES.fotosPorSubida, {
      limits: { fileSize: LIMITES.bytesMaximos },
    }),
  )
  subirAActividad(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) actividadId: number,
    @UploadedFiles() archivos: ArchivoSubido[],
    @Body() dto: { descripcion?: string; momento?: string },
  ) {
    return this.fotos.subir(
      usuario,
      { tipo: 'actividad', actividadId },
      archivos,
      dto?.descripcion,
      // El hueco del antes/después (Fase 3). Llega por multipart como un
      // campo más, y el service lo valida contra lo que esa actividad espera.
      dto?.momento,
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
    return this.fotos.subir(
      usuario,
      { tipo: 'bandeja' },
      archivos,
      dto?.descripcion,
    );
  }

  @Get('bandeja')
  bandeja(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.fotos.bandeja(usuario);
  }

  /** Clasificar por lotes (§18). El destino llega en el cuerpo. */
  @Post('bandeja/clasificar')
  clasificar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body()
    dto: {
      fotoIds?: number[];
      intervencionId?: number;
      actividadId?: number;
    },
  ) {
    // El cuerpo llega con ids sueltos —es lo natural en JSON— y aquí se
    // convierte en el destino tipado que el service exige. Traducir en la
    // frontera evita que la unión se contamine con opcionales.
    //
    // ⚠️ Ya no llegan `nombre` ni `descripcion`: eran del álbum que se creaba
    // al clasificar hacia una carpeta, y con los álbumes retirados el destino
    // ya existe siempre.
    const destino =
      dto?.actividadId !== undefined
        ? ({ tipo: 'actividad', actividadId: Number(dto.actividadId) } as const)
        : dto?.intervencionId !== undefined
          ? ({
              tipo: 'intervencion',
              intervencionId: Number(dto.intervencionId),
            } as const)
          : null;

    if (!destino)
      throw new BadRequestException(
        'Indica a dónde van las fotos: una actividad o una intervención.',
      );

    return this.fotos.clasificar(usuario, dto?.fotoIds ?? [], destino);
  }

  @Get('foto/:fotoId/descarga')
  descargar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.fotos.urlDeDescarga(usuario, fotoId);
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
    return this.fotos.editarDescripcion(usuario, fotoId, dto?.descripcion);
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
      intervencionId?: number;
      actividadId?: number;
      bandeja?: boolean;
    },
  ) {
    const destino =
      dto?.bandeja === true
        ? ({ tipo: 'bandeja' } as const)
        : dto?.actividadId !== undefined
          ? ({
              tipo: 'actividad',
              actividadId: Number(dto.actividadId),
            } as const)
          : dto?.intervencionId !== undefined
            ? ({
                tipo: 'intervencion',
                intervencionId: Number(dto.intervencionId),
              } as const)
            : null;

    if (!destino)
      throw new BadRequestException(
        'Indica a dónde va la foto: una actividad, una intervención, o «sin clasificar».',
      );

    return this.fotos.mover(usuario, fotoId, destino);
  }

  @Delete('foto/:fotoId')
  eliminarFoto(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.fotos.eliminar(usuario, fotoId);
  }
}
