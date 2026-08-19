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
  OrganizacionService,
  type CrearOrganizacionDto,
  type EditarOrganizacionDto,
} from './organizacion.service';
import {
  EstructuraService,
  type CrearNodoDto,
  type EditarNodoDto,
} from './estructura.service';
import { SoloSuperAdmin } from '../auth/decoradores';

/**
 * Gestión de equipos — Fase 1: organizaciones y su estructura.
 *
 * Todo el módulo va con `@SoloSuperAdmin()` de momento. El valor
 * `EQUIPOS` ya existe en el enum `Modulo`, así que abrirlo a otros roles
 * el día que se definan los permisos es cambiar este decorador por
 * `@RequiereModulo(Modulo.EQUIPOS)`, sin migración.
 */
@SoloSuperAdmin()
@Controller('equipos')
export class EquiposController {
  constructor(
    private readonly organizaciones: OrganizacionService,
    private readonly estructura: EstructuraService,
  ) {}

  // ── Organizaciones ──

  // GET /equipos/organizacion?soloActivas=true
  @Get('organizacion')
  listar(@Query('soloActivas') soloActivas?: string) {
    return this.organizaciones.listar(soloActivas !== 'true');
  }

  @Get('organizacion/:id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.organizaciones.detalle(id);
  }

  @Post('organizacion')
  crear(@Body() dto: CrearOrganizacionDto) {
    return this.organizaciones.crear(dto);
  }

  @Patch('organizacion/:id')
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarOrganizacionDto,
  ) {
    return this.organizaciones.editar(id, dto);
  }

  @Delete('organizacion/:id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.organizaciones.eliminar(id);
  }

  // ── Estructura ──

  @Get('organizacion/:id/estructura')
  arbol(@Param('id', ParseIntPipe) id: number) {
    return this.estructura.arbol(id);
  }

  @Get('nodo/:id/camino')
  camino(@Param('id', ParseIntPipe) id: number) {
    return this.estructura.camino(id);
  }

  @Post('nodo')
  crearNodo(@Body() dto: CrearNodoDto) {
    return this.estructura.crear(dto);
  }

  @Patch('nodo/:id')
  editarNodo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarNodoDto,
  ) {
    return this.estructura.editar(id, dto);
  }

  @Delete('nodo/:id')
  eliminarNodo(@Param('id', ParseIntPipe) id: number) {
    return this.estructura.eliminar(id);
  }
}
