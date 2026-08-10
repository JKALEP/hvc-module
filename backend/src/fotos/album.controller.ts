import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ErroresDeSubidaFilter } from './subida.filtro';
import { AlbumService } from './album.service';
import type { CrearAlbumDto, EditarAlbumDto } from './album.service';
import { FotoService } from './foto.service';
import type { ArchivoSubido } from './foto.service';
import { LIMITES } from './imagen.service';
import {
  RequiereModulo,
  RequiereNivelFotos,
  UsuarioActual,
} from '../auth/decoradores';
import { Modulo, NivelFotos } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Álbumes y su feed.
 *
 * El módulo FOTOS se exige a nivel de clase; el nivel ADMIN_FOTOS solo en
 * los endpoints de administración. Todo lo demás —ver el feed y subir— es
 * para cualquiera con acceso al álbum, sea admin o colaborador: quien
 * entra, publica.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos/album')
export class AlbumController {
  constructor(
    private readonly album: AlbumService,
    private readonly foto: FotoService,
  ) {}

  // Álbumes que el usuario ve. Admin: todos. Colaborador: los suyos.
  @Get()
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('sedeId', new ParseIntPipe({ optional: true })) sedeId?: number,
  ) {
    return this.album.listar(usuario, sedeId);
  }

  @Get(':id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.album.obtenerConAcceso(usuario, id);
  }

  @RequiereNivelFotos(NivelFotos.ADMIN_FOTOS)
  @Post()
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearAlbumDto,
  ) {
    return this.album.crear(usuario, dto);
  }

  // Renombrar, mover de sede y abrir/cerrar. Un álbum CERRADO es de solo
  // lectura para todos; reabrirlo también pasa por aquí.
  @RequiereNivelFotos(NivelFotos.ADMIN_FOTOS)
  @Put(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarAlbumDto) {
    return this.album.editar(id, dto);
  }

  // Con quién está compartido vive en `/fotos/compartir`: es el mismo
  // flujo para una carpeta que para un álbum y no debe partirse en dos.

  // ── Feed: para TODOS los que acceden al álbum ──

  @Get(':id/foto')
  feed(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('subidaPorId', new ParseIntPipe({ optional: true }))
    subidaPorId?: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.foto.feed(usuario, id, { subidaPorId, desde, hasta });
  }

  // Quiénes han publicado aquí, para el filtro del feed.
  @Get(':id/autores')
  autores(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.foto.autores(usuario, id);
  }

  /**
   * Sube fotos. Sin restricción de nivel: es el feed compartido.
   * Multer las mantiene en memoria — nunca tocan el disco, que en Render
   * es efímero.
   */
  @Post(':id/foto')
  // El filtro traduce los cortes de multer, que ocurren antes de que el
  // service llegue a validar nada.
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
    return this.foto.subir(usuario, id, archivos, dto?.descripcion);
  }

  // Puede borrar quien la subió o un ADMIN_FOTOS.
  @Delete(':id/foto/:fotoId')
  eliminarFoto(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.foto.eliminar(usuario, id, fotoId);
  }
}
