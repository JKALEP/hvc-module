import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CatalogoEquiposService } from './catalogo-equipos.service';
import type { GuardarEquipoDto } from '../equipos/equipo.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * El selector de equipos de Fotos (§12).
 *
 * Prefijo propio, `/fotos/catalogo-equipos`, y no una ruta bajo `/equipos`:
 * ahí TODO va con `@SoloSuperAdmin()`, y colgar de ese controller una ruta
 * con otro guard deja dos políticas en el mismo archivo —el sitio exacto
 * donde alguien acaba añadiendo un método sin mirar cuál le toca—.
 *
 * Las dos primeras rutas son de SOLO LECTURA. La tercera crea, y es la
 * única excepción: ver `CatalogoEquiposService.crearEquipo`.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos/catalogo-equipos')
export class CatalogoEquiposController {
  constructor(private readonly catalogo: CatalogoEquiposService) {}

  /** Paso 1 del selector: de qué organización es el equipo. */
  @Get('organizacion')
  organizaciones() {
    return this.catalogo.listarOrganizaciones();
  }

  /**
   * Paso 2: buscar dentro de ella.
   *
   * `q` busca en el código interno y en todos los valores de texto del
   * equipo, así que marca y modelo entran sin ser columnas.
   */
  @Get('organizacion/:id/equipo')
  equipos(
    @Param('id', ParseIntPipe) organizacionId: number,
    @Query('q') q?: string,
    @Query('pagina', new ParseIntPipe({ optional: true })) pagina?: number,
  ) {
    return this.catalogo.buscarEquipos({ organizacionId, q, pagina });
  }

  /**
   * Las ubicaciones de la organización, para el atajo de registro.
   *
   * `EquipoService.crear` exige un `nodoId`, y el árbol de ubicaciones solo
   * se lee con `@SoloSuperAdmin`: sin esta ruta el atajo no podía funcionar.
   */
  @Get('organizacion/:id/ubicacion')
  ubicaciones(@Param('id', ParseIntPipe) organizacionId: number) {
    return this.catalogo.listarUbicaciones(organizacionId);
  }

  /**
   * El atajo: registrar un equipo sin salir de Fotos.
   *
   * El nivel mínimo lo comprueba el service y no un decorador, porque
   * `@RequiereNivelFotos` compara por igualdad exacta y aquí hace falta
   * «EDITOR_GLOBAL o más».
   */
  @Post('equipo')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarEquipoDto,
  ) {
    return this.catalogo.crearEquipo(usuario, dto);
  }
}
