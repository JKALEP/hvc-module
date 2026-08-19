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
import { OpcionService } from './opcion.service';
import { ClienteService } from './cliente.service';
import { SupervisorService } from './supervisor.service';
import { SoloSuperAdmin, UsuarioActual } from '../../auth/decoradores';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type {
  GuardarOpcionDto,
  EditarOpcionDto,
  GuardarClienteDto,
  GuardarSupervisorDto,
} from './dto';

/**
 * Los maestros del módulo Costos: catálogos, clientes y supervisores.
 *
 * Un solo controller para los tres porque comparten forma —se listan, se
 * crean, se editan y se borran igual— y porque los tres son la misma
 * pantalla de §59: «Administrador → Catálogos». Lo que cambia (campos,
 * unicidad, qué impide borrarlos) vive en su service.
 *
 * `@SoloSuperAdmin()` en la clase, que es lo decidido para el
 * administrador del módulo: ya existe una cuenta que gestiona
 * configuración en todo el sistema, y un rol más solo para esto habría
 * sido una fila de permisos que nadie usa.
 *
 * Los tres listados también los va a consultar el Solicitante, que
 * necesita llenar los selectores del formulario de §13. Esas lecturas NO
 * se abren aquí: entrarán por el controller del requerimiento, acotadas
 * a las opciones activas. Un endpoint de administración y uno de
 * consulta no son el mismo endpoint aunque devuelvan lo mismo hoy.
 */
@SoloSuperAdmin()
@Controller('costos/admin')
export class CatalogoController {
  constructor(
    private readonly opciones: OpcionService,
    private readonly clientes: ClienteService,
    private readonly supervisores: SupervisorService,
  ) {}

  // ── Catálogos: tipos de mantenimiento, tipos de requerimiento, unidades ──

  /** GET /costos/admin/catalogo?tipo=UNIDAD_MEDIDA&soloActivas=true */
  @Get('catalogo')
  listarOpciones(
    @Query('tipo') tipo?: string,
    @Query('soloActivas') soloActivas?: string,
  ) {
    return this.opciones.listar({ tipo, soloActivas: soloActivas === 'true' });
  }

  @Post('catalogo')
  crearOpcion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarOpcionDto,
  ) {
    return this.opciones.crear(usuario, dto);
  }

  @Patch('catalogo/:id')
  editarOpcion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarOpcionDto,
  ) {
    return this.opciones.editar(usuario, id, dto);
  }

  @Delete('catalogo/:id')
  eliminarOpcion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.opciones.eliminar(usuario, id);
  }

  // ── Clientes ──

  @Get('cliente')
  listarClientes(
    @Query('q') q?: string,
    @Query('soloActivos') soloActivos?: string,
  ) {
    return this.clientes.listar({ q, soloActivos: soloActivos === 'true' });
  }

  @Get('cliente/:id')
  detalleCliente(@Param('id', ParseIntPipe) id: number) {
    return this.clientes.detalle(id);
  }

  @Post('cliente')
  crearCliente(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarClienteDto,
  ) {
    return this.clientes.crear(usuario, dto);
  }

  @Patch('cliente/:id')
  editarCliente(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarClienteDto,
  ) {
    return this.clientes.editar(usuario, id, dto);
  }

  @Delete('cliente/:id')
  eliminarCliente(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.clientes.eliminar(usuario, id);
  }

  // ── Supervisores ──

  @Get('supervisor')
  listarSupervisores(
    @Query('q') q?: string,
    @Query('soloActivos') soloActivos?: string,
  ) {
    return this.supervisores.listar({
      q,
      soloActivos: soloActivos === 'true',
    });
  }

  @Get('supervisor/:id')
  detalleSupervisor(@Param('id', ParseIntPipe) id: number) {
    return this.supervisores.detalle(id);
  }

  @Post('supervisor')
  crearSupervisor(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarSupervisorDto,
  ) {
    return this.supervisores.crear(usuario, dto);
  }

  @Patch('supervisor/:id')
  editarSupervisor(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarSupervisorDto,
  ) {
    return this.supervisores.editar(usuario, id, dto);
  }

  @Delete('supervisor/:id')
  eliminarSupervisor(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.supervisores.eliminar(usuario, id);
  }
}
