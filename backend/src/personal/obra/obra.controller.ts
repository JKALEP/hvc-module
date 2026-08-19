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
import { CarpetaService } from './carpeta.service';
import { NavegacionService } from './navegacion.service';
import { ProyectoService } from './proyecto.service';
import { JornadaService } from './jornada.service';
import { AnaliticaService } from './analitica.service';
import { AsignacionService } from './asignacion.service';
import { RequiereModulo, UsuarioActual } from '../../auth/decoradores';
import { Modulo, TipoPersonal } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aFecha } from './validacion';
import type {
  CrearCarpetaDto,
  EditarCarpetaDto,
  CrearProyectoDto,
  EditarProyectoDto,
  GuardarJornadaDto,
  EditarJornadaDto,
} from './dto';

/**
 * Obra: carpetas, proyectos y su registro diario.
 *
 * Un controller para los tres recursos porque son una sola pantalla
 * —el explorador y la ficha— y siempre se usan juntos. La lógica está
 * repartida en seis services, uno por responsabilidad.
 */
@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('obra')
export class ObraController {
  constructor(
    private readonly carpetas: CarpetaService,
    private readonly navegacion: NavegacionService,
    private readonly proyectos: ProyectoService,
    private readonly jornadas: JornadaService,
    private readonly analitica: AnaliticaService,
    private readonly asignacion: AsignacionService,
  ) {}

  // ── Explorador ──
  // Sin id = la raíz.

  @Get('navegacion')
  raiz() {
    return this.navegacion.contenido(null);
  }

  @Get('navegacion/:carpetaId')
  dentroDe(@Param('carpetaId', ParseIntPipe) carpetaId: number) {
    return this.navegacion.contenido(carpetaId);
  }

  // ── Carpetas ──

  @Get('carpeta')
  listarCarpetas() {
    return this.carpetas.listar();
  }

  @Post('carpeta')
  crearCarpeta(@Body() dto: CrearCarpetaDto) {
    return this.carpetas.crear(dto);
  }

  @Patch('carpeta/:id')
  editarCarpeta(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarCarpetaDto,
  ) {
    return this.carpetas.editar(id, dto);
  }

  @Delete('carpeta/:id')
  eliminarCarpeta(@Param('id', ParseIntPipe) id: number) {
    return this.carpetas.eliminar(id);
  }

  // ── Catálogos de personal para los selectores ──
  // Se resuelven contra el periodo que cubre la fecha indicada, no
  // contra el más reciente.

  @Get('personal/empresas')
  empresas(@Query('fecha') fecha: string) {
    return this.asignacion.empresasPara(aFecha(fecha, 'fecha'));
  }

  @Get('personal/supervisores')
  supervisores(@Query('fecha') fecha: string, @Query('q') q?: string) {
    return this.asignacion.personasPara(
      aFecha(fecha, 'fecha'),
      TipoPersonal.SUPERVISOR,
      q,
    );
  }

  @Get('personal/contratistas')
  contratistas(@Query('fecha') fecha: string, @Query('q') q?: string) {
    return this.asignacion.personasPara(
      aFecha(fecha, 'fecha'),
      TipoPersonal.CONTRATISTA,
      q,
    );
  }

  // ── Proyectos ──

  @Post('proyecto')
  crearProyecto(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearProyectoDto,
  ) {
    return this.proyectos.crear(usuario, dto);
  }

  @Get('proyecto/:id')
  detalleProyecto(@Param('id', ParseIntPipe) id: number) {
    return this.proyectos.detalle(id);
  }

  @Patch('proyecto/:id')
  editarProyecto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarProyectoDto,
  ) {
    return this.proyectos.editar(id, dto);
  }

  @Delete('proyecto/:id')
  eliminarProyecto(@Param('id', ParseIntPipe) id: number) {
    return this.proyectos.eliminar(id);
  }

  // ── Jornadas ──

  @Get('proyecto/:id/jornada')
  listarJornadas(@Param('id', ParseIntPipe) id: number) {
    return this.jornadas.listar(id);
  }

  @Post('proyecto/:id/jornada')
  guardarJornada(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarJornadaDto,
  ) {
    return this.jornadas.guardar(usuario, id, dto);
  }

  @Patch('jornada/:id')
  editarJornada(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarJornadaDto,
  ) {
    return this.jornadas.editar(id, dto);
  }

  @Delete('jornada/:id')
  eliminarJornada(@Param('id', ParseIntPipe) id: number) {
    return this.jornadas.eliminar(id);
  }

  // ── Analítica de la obra ──

  @Get('proyecto/:id/empresas')
  empresasParticipantes(@Param('id', ParseIntPipe) id: number) {
    return this.analitica.empresas(id);
  }

  @Get('proyecto/:id/participacion')
  participacion(@Param('id', ParseIntPipe) id: number) {
    return this.analitica.participacion(id);
  }

  @Get('proyecto/:id/persona/:documento')
  calendarioDePersona(
    @Param('id', ParseIntPipe) id: number,
    @Param('documento') documento: string,
  ) {
    return this.analitica.calendarioDe(id, documento);
  }
}
