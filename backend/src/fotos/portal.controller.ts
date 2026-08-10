import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { NavegacionService } from './navegacion.service';
import { FotoService } from './foto.service';
import { AccesoService } from './acceso.service';
import { PermiteCliente, UsuarioActual } from '../auth/decoradores';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Portal del cliente externo. Solo lectura y descarga.
 *
 * Es un controller aparte y no un `if` dentro de los de Fotos porque lo
 * que un cliente puede hacer es un subconjunto tan pequeño que
 * enumerarlo es más seguro que filtrarlo: aquí no existe ninguna ruta de
 * escritura que se pueda dejar abierta por descuido.
 */
@PermiteCliente()
@Controller('portal')
export class PortalController {
  constructor(
    private readonly navegacion: NavegacionService,
    private readonly foto: FotoService,
    private readonly acceso: AccesoService,
  ) {}

  /** Solo para clientes: un interno tiene su propio explorador. */
  private exigirCliente(usuario: UsuarioAutenticado) {
    if (!this.acceso.esCliente(usuario))
      throw new ForbiddenException(
        'El portal es para cuentas externas. Usa la sección Fotos.',
      );
  }

  @Get('navegacion')
  async contenido(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('sedeId', new ParseIntPipe({ optional: true })) sedeId?: number,
  ) {
    this.exigirCliente(usuario);
    return this.navegacion.contenido(
      usuario,
      { tipo: 'alcance' },
      sedeId ?? null,
    );
  }

  @Get('album/:id/foto')
  async feed(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    this.exigirCliente(usuario);
    // Sin filtro por autor: a un cliente no se le enseña quién de HVC
    // subió cada foto.
    return this.foto.feed(usuario, id, { desde, hasta }, { anonimo: true });
  }

  /** URL de descarga: el navegador la guarda en vez de abrirla. */
  @Get('album/:id/foto/:fotoId/descarga')
  async descargar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    this.exigirCliente(usuario);
    return this.foto.urlDeDescarga(usuario, id, fotoId);
  }
}
