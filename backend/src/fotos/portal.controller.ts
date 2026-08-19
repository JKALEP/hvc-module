import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { NavegacionService } from './navegacion.service';
import { AlbumService } from './album.service';
import { AccesoService } from './acceso.service';
import { PermiteCliente, UsuarioActual } from '../auth/decoradores';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Portal del cliente externo. Solo lectura y descarga.
 *
 * Controller aparte y no un `if` dentro de los internos: lo que un
 * cliente puede hacer es un subconjunto tan pequeño que enumerarlo es
 * más seguro que filtrarlo. Aquí no existe ninguna ruta de escritura que
 * se pueda dejar abierta por descuido.
 */
@PermiteCliente()
@Controller('portal')
export class PortalController {
  constructor(
    private readonly navegacion: NavegacionService,
    private readonly album: AlbumService,
    private readonly acceso: AccesoService,
  ) {}

  private exigirCliente(usuario: UsuarioAutenticado) {
    if (!this.acceso.esCliente(usuario))
      throw new ForbiddenException(
        'El portal es para cuentas externas. Usa la sección Fotos.',
      );
  }

  @Get('carpeta')
  raiz(@UsuarioActual() usuario: UsuarioAutenticado) {
    this.exigirCliente(usuario);
    return this.navegacion.contenido(usuario, null);
  }

  @Get('carpeta/:id')
  contenido(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.exigirCliente(usuario);
    return this.navegacion.contenido(usuario, id);
  }

  @Get('carpeta/:id/album')
  galeria(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    this.exigirCliente(usuario);
    // `anonimo`: a un cliente no se le enseña qué persona de HVC subió qué.
    return this.album.galeria(usuario, id, {
      cursor,
      desde,
      hasta,
      anonimo: true,
    });
  }

  @Get('foto/:fotoId/descarga')
  descargar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    this.exigirCliente(usuario);
    return this.album.urlDeDescarga(usuario, fotoId);
  }
}
