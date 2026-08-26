import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { IntervencionService } from './intervencion.service';
import { CatalogoActividadService } from './catalogo-actividad.service';
import { ObservacionService } from './observacion.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Las intervenciones de un equipo (Fase 1 del rediseño).
 *
 * `@Controller('fotos')` con sub-rutas explícitas, igual que los demás del
 * módulo: así `intervencion/:id/...` convive con `carpeta/:id/intervencion` sin que un
 * parámetro se coma una ruta literal.
 *
 * El permiso lo decide `IntervencionService`: leer el historial es LECTURA sobre la
 * carpeta, y abrir, cerrar, reabrir o cambiar el estado es EDICION. No hay
 * nada aquí que un ADMIN_GLOBAL pueda hacer y otro no — el candado del
 * historial no es de rol, es de estado dla intervención.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class IntervencionController {
  constructor(
    private readonly intervenciones: IntervencionService,
    private readonly catalogo: CatalogoActividadService,
    private readonly observaciones: ObservacionService,
  ) {}

  /** El historial completo, del más reciente al más antiguo. */
  @Get('carpeta/:id/intervencion')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
  ) {
    return this.intervenciones.listar(usuario, carpetaId);
  }

  /** Abre una intervención nueva heredando el checklist de la anterior (§4.3). */
  @Post('carpeta/:id/intervencion')
  abrir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
  ) {
    return this.intervenciones.abrir(usuario, carpetaId);
  }

  @Get('intervencion/:id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.intervenciones.detalle(usuario, id);
  }

  /**
   * Cerrar y reabrir son POST propios, no un campo de un PATCH.
   *
   * Es el mismo criterio que archivar una carpeta: son decisiones distintas
   * de editar, escriben varias columnas a la vez y cada una deja su propia
   * entrada en la bitácora. Con un booleano en el PATCH acabarían mezcladas
   * con la edición corriente en el cliente y en el servidor.
   */
  @Post('intervencion/:id/cerrar')
  cerrar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.intervenciones.cerrar(usuario, id);
  }

  @Post('intervencion/:id/reabrir')
  reabrir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.intervenciones.reabrir(usuario, id);
  }

  /**
   * Trae actividades del catálogo a una intervención abierta (Fase 2).
   *
   * Existe además de la preselección del alta porque un equipo dado de alta
   * antes de que HVC cargara su checklist se quedaría sin él para siempre, y
   * porque cambiar el tipo de sistema NO reescribe las intervenciones: traerlas es
   * una decisión explícita de quien está trabajando.
   */
  @Post('intervencion/:id/actividad/desde-catalogo')
  desdeCatalogo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { definiciones?: unknown },
  ) {
    return this.catalogo.anadirAIntervencion(usuario, id, dto?.definiciones);
  }

  // ── Observaciones (§8, Fase 5) ──
  //
  // Cuelgan de la intervención en la URL porque es desde una intervención desde donde se
  // levantan y se atienden. Pero la fila es del EQUIPO: por eso `GET` trae
  // también las ARRASTRADAS —pendientes de intervenciónes anteriores— y por eso
  // resolver una no exige que su intervención de origen siga abierta.

  @Get('intervencion/:id/observacion')
  listarObservaciones(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.observaciones.listarDeIntervencion(usuario, id);
  }

  @Post('intervencion/:id/observacion')
  crearObservacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { texto?: unknown },
  ) {
    return this.observaciones.crear(usuario, id, dto?.texto);
  }

  @Patch('observacion/:id')
  editarObservacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { texto?: unknown },
  ) {
    return this.observaciones.editar(usuario, id, dto?.texto);
  }

  /**
   * Resolver y reabrir son POST propios, no un PATCH con `{estado}`.
   *
   * Escriben cuatro columnas a la vez —estado, cuándo, quién y en qué
   * visita— y se disparan desde una casilla, no desde el formulario. Es el
   * mismo criterio que completar una actividad y que cerrar una intervención.
   */
  @Post('observacion/:id/resolver')
  resolverObservacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.observaciones.resolver(usuario, id, true);
  }

  @Post('observacion/:id/reabrir')
  reabrirObservacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.observaciones.resolver(usuario, id, false);
  }

  @Delete('observacion/:id')
  eliminarObservacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.observaciones.eliminar(usuario, id);
  }

  /** El estado del equipo en esta intervención (§7). `null` lo deja sin definir. */
  @Patch('intervencion/:id/estado')
  cambiarEstado(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { estadoId?: unknown },
  ) {
    return this.intervenciones.cambiarEstado(usuario, id, dto?.estadoId);
  }
}
