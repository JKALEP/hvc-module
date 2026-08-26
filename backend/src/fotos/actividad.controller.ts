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
import { ObservacionService } from './observacion.service';
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
    private readonly observaciones: ObservacionService,
  ) {}

  // ── Actividades ──

  /**
   * Las actividades de UNA INTERVENCIÓN. `estado` filtra; sin él, todas.
   *
   * ⚠️ Cuelga de `intervencion/:id` y no de `carpeta/:id` desde la Fase 1. Es un
   * cambio de contrato deliberado: un equipo tiene la misma actividad
   * repetida en cada intervención, así que pedirlas «de la carpeta» no tiene una
   * respuesta única. La pantalla siempre está mirando UN intervencion.
   */
  @Get('intervencion/:id/actividad')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) intervencionId: number,
    @Query('estado') estado?: string,
  ) {
    return this.actividades.listar(usuario, intervencionId, { estado });
  }

  @Post('intervencion/:id/actividad')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) intervencionId: number,
    @Body() dto: CrearActividadDto,
  ) {
    return this.actividades.crear(usuario, intervencionId, dto);
  }

  // ⚠️ Aquí estaba `GET actividad-asignables`, que servía el desplegable de
  // «responsable». Se fue con el detalle de la actividad: sin responsable no
  // hay a quién asignar. La ruta se retira entera en vez de dejarla
  // respondiendo una lista que nadie consume — un endpoint sin puerta es el
  // patrón que este módulo lleva dos fases persiguiendo.

  /**
   * Las observaciones de UNA actividad.
   *
   * Cuelgan de `actividad/:id` y no de `intervencion/:id` porque se leen dentro de
   * la actividad, junto a sus fotos y sus comentarios. El panel general del
   * equipo no las repite: las cuenta una sola vez, en su sitio.
   */
  @Get('actividad/:id/observacion')
  observacionesDeActividad(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.observaciones.listarDeActividad(usuario, id);
  }

  @Post('actividad/:id/observacion')
  crearObservacionEnActividad(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { texto?: unknown },
  ) {
    return this.observaciones.crearEnActividad(usuario, id, dto?.texto);
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
