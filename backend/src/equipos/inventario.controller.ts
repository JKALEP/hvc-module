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
  CampoService,
  type CrearCampoDto,
  type EditarCampoDto,
} from './campo.service';
import {
  EquipoService,
  type GuardarEquipoDto,
  type EditarEquipoDto,
} from './equipo.service';
import {
  EquipoBusquedaService,
  type FiltroCampo,
} from './equipo-busqueda.service';
import { SoloSuperAdmin } from '../auth/decoradores';
import type { UsuarioAutenticado } from '../auth/tipos';
import { UsuarioActual } from '../auth/decoradores';

/**
 * Gestión de equipos — Fase 2: campos dinámicos e inventario.
 *
 * Controller aparte del de organizaciones y estructura: son dos etapas
 * distintas del flujo (configurar el cliente vs. operar su inventario) y
 * juntarlas daría un controller de 250 líneas que crece con cada fase.
 */
@SoloSuperAdmin()
@Controller('equipos')
export class InventarioController {
  constructor(
    private readonly campos: CampoService,
    private readonly equipos: EquipoService,
    private readonly busqueda: EquipoBusquedaService,
  ) {}

  // ── Campos ──

  // GET /equipos/organizacion/1/campo?soloActivos=true
  @Get('organizacion/:id/campo')
  listarCampos(
    @Param('id', ParseIntPipe) id: number,
    @Query('soloActivos') soloActivos?: string,
  ) {
    return this.campos.listar(id, soloActivos === 'true');
  }

  @Post('campo')
  crearCampo(@Body() dto: CrearCampoDto) {
    return this.campos.crear(dto);
  }

  @Patch('campo/:id')
  editarCampo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarCampoDto,
  ) {
    return this.campos.editar(id, dto);
  }

  @Delete('campo/:id')
  eliminarCampo(@Param('id', ParseIntPipe) id: number) {
    return this.campos.eliminar(id);
  }

  @Post('campo/:id/opcion')
  agregarOpcion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { etiqueta?: string | null },
  ) {
    return this.campos.agregarOpcion(id, dto.etiqueta);
  }

  @Patch('opcion/:id')
  editarOpcion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { etiqueta?: string | null; activo?: boolean | null },
  ) {
    return this.campos.editarOpcion(id, dto);
  }

  @Delete('opcion/:id')
  eliminarOpcion(@Param('id', ParseIntPipe) id: number) {
    return this.campos.eliminarOpcion(id);
  }

  // ── Inventario ──
  // OJO: las rutas literales van ANTES de :id.

  /**
   * GET /equipos/organizacion/1/equipo?nodoId=3&q=carrier&campo.marca=7
   *
   * Los filtros por campo dinámico llegan como `campo.<clave>=<valor>`:
   * así el número de filtros no está fijado por la firma del endpoint,
   * que es justo lo que hace falta cuando las columnas las define cada
   * organización.
   */
  @Get('organizacion/:id/equipo')
  listarEquipos(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: Record<string, string>,
  ) {
    const campos: FiltroCampo[] = Object.entries(query)
      .filter(([k]) => k.startsWith('campo.'))
      .map(([k, valor]) => ({ clave: k.slice('campo.'.length), valor }));

    return this.busqueda.listar({
      organizacionId: id,
      nodoId: query.nodoId ? Number(query.nodoId) : null,
      q: query.q ?? null,
      campos,
      pagina: query.pagina ? Number(query.pagina) : 1,
    });
  }

  @Post('equipo')
  crearEquipo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarEquipoDto,
  ) {
    return this.equipos.crear(usuario, dto);
  }

  @Get('equipo/:id')
  detalleEquipo(@Param('id', ParseIntPipe) id: number) {
    return this.equipos.detalle(id);
  }

  @Get('equipo/:id/historial')
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.equipos.historialDe(id);
  }

  @Patch('equipo/:id')
  editarEquipo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarEquipoDto,
  ) {
    return this.equipos.editar(usuario, id, dto);
  }

  @Delete('equipo/:id')
  eliminarEquipo(@Param('id', ParseIntPipe) id: number) {
    return this.equipos.eliminar(id);
  }
}
