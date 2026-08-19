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
import { TareaService } from './tarea.service';
import type { CrearTareaDto, EditarTareaDto } from './tarea.service';
import { ComentarioService } from './comentario.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Tareas (§13) y comentarios (§14).
 *
 * `@Controller('fotos')` con sub-rutas explícitas, igual que
 * `CarpetaController` y por lo mismo: así `comentario/:id` no cae dentro de
 * `tarea/:id`.
 *
 * Los comentarios viven aquí y no en un controller propio porque son un
 * recurso pequeño que cuelga de otros tres; separarlos habría dejado un
 * archivo de cuatro rutas y una importación cruzada para nada.
 *
 * ⚠️ **No hay un decorador de nivel en ninguna ruta, y es correcto.** El
 * permiso es POR CARPETA y lo exige el service con `AccesoService`; un
 * decorador solo sabe quién pide, no sobre qué.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class TareaController {
  constructor(
    private readonly tareas: TareaService,
    private readonly comentarios: ComentarioService,
  ) {}

  // ── Tareas ──

  /** Las tareas de un equipo. `estado` filtra; sin él, todas. */
  @Get('carpeta/:id/tarea')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
    @Query('estado') estado?: string,
  ) {
    return this.tareas.listar(usuario, carpetaId, { estado });
  }

  @Post('carpeta/:id/tarea')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
    @Body() dto: CrearTareaDto,
  ) {
    return this.tareas.crear(usuario, carpetaId, dto);
  }

  @Get('tarea/:id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tareas.detalle(usuario, id);
  }

  @Patch('tarea/:id')
  editar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarTareaDto,
  ) {
    return this.tareas.editar(usuario, id, dto);
  }

  /**
   * El check rápido de §13. Dos rutas y no un PATCH con `{estado}`, por lo
   * mismo que archivar una carpeta tiene la suya: escribe tres columnas a
   * la vez y se dispara desde una casilla, no desde el formulario.
   */
  @Post('tarea/:id/completar')
  completar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tareas.completar(usuario, id, true);
  }

  @Post('tarea/:id/reabrir')
  reabrir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tareas.completar(usuario, id, false);
  }

  @Delete('tarea/:id')
  eliminar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tareas.eliminar(usuario, id);
  }

  // ── Comentarios (§14) ──
  //
  // `:entidad` es `carpeta`, `tarea` o `album`. Un equipo se comenta como
  // la carpeta que es (§12), así que no hay una cuarta.

  @Get('comentario/:entidad/:id')
  listarComentarios(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('entidad') entidad: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.comentarios.listar(usuario, entidad, id);
  }

  @Post('comentario/:entidad/:id')
  comentar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('entidad') entidad: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { texto?: string | null },
  ) {
    return this.comentarios.crear(usuario, entidad, id, dto?.texto);
  }

  @Patch('comentario/:id')
  editarComentario(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { texto?: string | null },
  ) {
    return this.comentarios.editar(usuario, id, dto?.texto);
  }

  @Delete('comentario/:id')
  eliminarComentario(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.comentarios.eliminar(usuario, id);
  }
}
