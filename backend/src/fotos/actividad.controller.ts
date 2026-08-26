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
import { ActividadService } from './actividad.service';
import type {
  CrearActividadDto,
  EditarActividadDto,
} from './actividad.service';
import { ComentarioService } from './comentario.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Actividades (§13) y comentarios (§14).
 *
 * `@Controller('fotos')` con sub-rutas explícitas, igual que
 * `CarpetaController` y por lo mismo: así `comentario/:id` no cae dentro de
 * `actividad/:id`.
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
export class ActividadController {
  constructor(
    private readonly actividades: ActividadService,
    private readonly comentarios: ComentarioService,
  ) {}

  // ── Actividades ──

  /**
   * Las actividades de UN CICLO. `estado` filtra; sin él, todas.
   *
   * ⚠️ Cuelga de `ciclo/:id` y no de `carpeta/:id` desde la Fase 1. Es un
   * cambio de contrato deliberado: un equipo tiene la misma actividad
   * repetida en cada visita, así que pedirlas «de la carpeta» no tiene una
   * respuesta única. La pantalla siempre está mirando UN ciclo.
   */
  @Get('ciclo/:id/actividad')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) cicloId: number,
    @Query('estado') estado?: string,
  ) {
    return this.actividades.listar(usuario, cicloId, { estado });
  }

  @Post('ciclo/:id/actividad')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) cicloId: number,
    @Body() dto: CrearActividadDto,
  ) {
    return this.actividades.crear(usuario, cicloId, dto);
  }

  /**
   * Quién puede ser responsable (§13). Hermana de `actividad/:id` y declarada
   * ANTES, para que `asignables` no caiga en el parámetro `:id`.
   */
  @Get('actividad-asignables')
  asignables() {
    return this.actividades.asignables();
  }

  /** Las fotos de una actividad (§15). */
  @Get('actividad/:id/foto')
  fotosDeActividad(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.actividades.fotosDe(usuario, id);
  }

  @Get('actividad/:id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.actividades.detalle(usuario, id);
  }

  @Patch('actividad/:id')
  editar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarActividadDto,
  ) {
    return this.actividades.editar(usuario, id, dto);
  }

  /**
   * El check rápido de §13. Dos rutas y no un PATCH con `{estado}`, por lo
   * mismo que archivar una carpeta tiene la suya: escribe tres columnas a
   * la vez y se dispara desde una casilla, no desde el formulario.
   */
  @Post('actividad/:id/completar')
  completar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.actividades.completar(usuario, id, true);
  }

  @Post('actividad/:id/reabrir')
  reabrir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.actividades.completar(usuario, id, false);
  }

  @Delete('actividad/:id')
  eliminar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.actividades.eliminar(usuario, id);
  }

  // ── Comentarios (§14) ──
  //
  // `:entidad` es `carpeta`, `actividad` o `album`. Un equipo se comenta como
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
