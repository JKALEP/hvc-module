import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { CicloService } from './ciclo.service';
import { CatalogoActividadService } from './catalogo-actividad.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Los ciclos de un equipo (Fase 1 del rediseño).
 *
 * `@Controller('fotos')` con sub-rutas explícitas, igual que los demás del
 * módulo: así `ciclo/:id/...` convive con `carpeta/:id/ciclo` sin que un
 * parámetro se coma una ruta literal.
 *
 * El permiso lo decide `CicloService`: leer el historial es LECTURA sobre la
 * carpeta, y abrir, cerrar, reabrir o cambiar el estado es EDICION. No hay
 * nada aquí que un ADMIN_GLOBAL pueda hacer y otro no — el candado del
 * historial no es de rol, es de estado del ciclo.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class CicloController {
  constructor(
    private readonly ciclos: CicloService,
    private readonly catalogo: CatalogoActividadService,
  ) {}

  /** El historial completo, del más reciente al más antiguo. */
  @Get('carpeta/:id/ciclo')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
  ) {
    return this.ciclos.listar(usuario, carpetaId);
  }

  /** Abre una visita nueva heredando el checklist de la anterior (§4.3). */
  @Post('carpeta/:id/ciclo')
  abrir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
  ) {
    return this.ciclos.abrir(usuario, carpetaId);
  }

  @Get('ciclo/:id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ciclos.detalle(usuario, id);
  }

  /**
   * Cerrar y reabrir son POST propios, no un campo de un PATCH.
   *
   * Es el mismo criterio que archivar una carpeta: son decisiones distintas
   * de editar, escriben varias columnas a la vez y cada una deja su propia
   * entrada en la bitácora. Con un booleano en el PATCH acabarían mezcladas
   * con la edición corriente en el cliente y en el servidor.
   */
  @Post('ciclo/:id/cerrar')
  cerrar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ciclos.cerrar(usuario, id);
  }

  @Post('ciclo/:id/reabrir')
  reabrir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ciclos.reabrir(usuario, id);
  }

  /**
   * Trae actividades del catálogo a un ciclo abierto (Fase 2).
   *
   * Existe además de la preselección del alta porque un equipo dado de alta
   * antes de que HVC cargara su checklist se quedaría sin él para siempre, y
   * porque cambiar el tipo de sistema NO reescribe las visitas: traerlas es
   * una decisión explícita de quien está trabajando.
   */
  @Post('ciclo/:id/actividad/desde-catalogo')
  desdeCatalogo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { definiciones?: unknown },
  ) {
    return this.catalogo.anadirACiclo(usuario, id, dto?.definiciones);
  }

  /** El estado del equipo en este ciclo (§7). `null` lo deja sin definir. */
  @Patch('ciclo/:id/estado')
  cambiarEstado(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { estadoId?: unknown },
  ) {
    return this.ciclos.cambiarEstado(usuario, id, dto?.estadoId);
  }
}
