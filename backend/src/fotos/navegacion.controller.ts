import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { NavegacionService } from './navegacion.service';
import type { Visibilidad } from './navegacion.service';
import { AlbumService } from './album.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Navegación por carpetas para usuarios internos.
 *
 * A diferencia de `SedeController`, aquí NO se exige `ADMIN_FOTOS`: un
 * colaborador también necesita esta ruta para su pantalla principal.
 * Quién ve qué lo decide la visibilidad que se arma aquí abajo, no el
 * decorador.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos/navegacion')
export class NavegacionController {
  constructor(
    private readonly navegacion: NavegacionService,
    private readonly album: AlbumService,
  ) {}

  @Get()
  async contenido(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('sedeId', new ParseIntPipe({ optional: true })) sedeId?: number,
  ) {
    const visibilidad: Visibilidad = this.album.esAdminFotos(usuario)
      ? { tipo: 'admin' }
      : { tipo: 'alcance' };

    return this.navegacion.contenido(usuario, visibilidad, sedeId ?? null);
  }
}
