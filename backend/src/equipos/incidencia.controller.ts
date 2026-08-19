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
import {
  IncidenciaService,
  type CrearIncidenciaDto,
  type EditarIncidenciaDto,
} from './incidencia.service';
import { SoloSuperAdmin, UsuarioActual } from '../auth/decoradores';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Gestión de equipos — Fase 3: incidencias.
 *
 * Controller propio, como el de inventario: cada etapa del flujo tiene
 * el suyo para que ninguno crezca con las fases siguientes.
 */
@SoloSuperAdmin()
@Controller('equipos')
export class IncidenciaController {
  constructor(private readonly incidencias: IncidenciaService) {}

  // GET /equipos/organizacion/1/incidencia?estado=ABIERTA&equipoId=3&q=fuga
  @Get('organizacion/:id/incidencia')
  listar(
    @Param('id', ParseIntPipe) id: number,
    @Query('estado') estado?: string,
    @Query('equipoId') equipoId?: string,
    @Query('q') q?: string,
  ) {
    return this.incidencias.listar({
      organizacionId: id,
      estado: estado ?? null,
      equipoId: equipoId ? Number(equipoId) : null,
      q: q ?? null,
    });
  }

  @Post('incidencia')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearIncidenciaDto,
  ) {
    return this.incidencias.crear(usuario, dto);
  }

  @Get('incidencia/:id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.incidencias.detalle(id);
  }

  @Get('incidencia/:id/historial')
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.incidencias.historialDe(id);
  }

  @Patch('incidencia/:id')
  editar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarIncidenciaDto,
  ) {
    return this.incidencias.editar(usuario, id, dto);
  }

  @Delete('incidencia/:id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.incidencias.eliminar(id);
  }
}
