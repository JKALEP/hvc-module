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
} from '@nestjs/common';
import { NavegacionService } from './navegacion.service';
import { CarpetaService } from './carpeta.service';
import type { CrearCarpetaDto, EditarCarpetaDto } from './carpeta.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Carpetas: navegar y administrar. Todo bajo `/fotos/carpeta`.
 *
 * En v2 esto estaban repartidos entre `carpeta.controller` (leer) y
 * `sede.controller` (escribir), y eso dejaba `POST /fotos/sede` creando lo
 * que `GET /fotos/carpeta` devolvía. Un mismo recurso con dos nombres en la
 * misma API.
 *
 * Las fotos se fueron a `AlbumController`: colgaban de aquí porque en v2 la
 * galería era de la carpeta, pero son otro recurso y otro service.
 *
 * `@Controller('fotos')` y no `('fotos/carpeta')` para que `recientes` sea
 * una ruta hermana y no caiga en `carpeta/:id`, que es la trampa clásica de
 * un parámetro que se come a una ruta literal declarada después.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class CarpetaController {
  constructor(
    private readonly navegacion: NavegacionService,
    private readonly carpeta: CarpetaService,
  ) {}

  /**
   * Contenido de la raíz: «Mis carpetas» y «Compartido conmigo» (§8, §21),
   * o el árbol entero para quien tiene nivel global.
   *
   * Con `q` deja de ser la raíz y pasa a ser una búsqueda en todo el árbol
   * visible, esté donde esté quien pregunta.
   */
  @Get('carpeta')
  raiz(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('q') q?: string,
    @Query('orden') orden?: string,
  ) {
    return this.navegacion.contenido(usuario, null, { q, orden });
  }

  /** Lo que cambió hace menos, de todo lo que este usuario alcanza (§21). */
  @Get('recientes')
  recientes(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.navegacion.recientes(usuario);
  }

  @Get('carpeta/:id')
  contenido(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('q') q?: string,
    @Query('orden') orden?: string,
  ) {
    return this.navegacion.contenido(usuario, id, { q, orden });
  }

  @Post('carpeta')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearCarpetaDto,
  ) {
    return this.carpeta.crear(usuario, dto);
  }

  /** Renombrar y/o mover. Archivar tiene su propia ruta: otra regla. */
  @Patch('carpeta/:id')
  editar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarCarpetaDto,
  ) {
    return this.carpeta.editar(usuario, id, dto);
  }

  /**
   * Archivar y reabrir, dos rutas y no un booleano en el PATCH.
   *
   * Es una decisión distinta de renombrar —la toma otro rol y sobre otra
   * pregunta: «esta obra ya terminó»—, y con un campo más del PATCH acababa
   * mezclada con la edición corriente en el cliente y en el servidor.
   */
  @Post('carpeta/:id/archivar')
  archivar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.carpeta.archivar(usuario, id, true);
  }

  @Post('carpeta/:id/reabrir')
  reabrir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.carpeta.archivar(usuario, id, false);
  }

  @Delete('carpeta/:id')
  eliminar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.carpeta.eliminar(usuario, id);
  }
}
