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
import { PeriodoService } from './periodo.service';
import { GrupoService } from './grupo.service';
import { FichaService } from './ficha.service';
import { CatalogoService } from './catalogo.service';
import { RequiereModulo, UsuarioActual } from '../../auth/decoradores';
import { Modulo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type {
  CrearPeriodoDto,
  CopiarPeriodoDto,
  CrearGrupoDto,
  EditarGrupoDto,
  CrearFichaDto,
  EditarFichaDto,
  MoverFichasDto,
  EliminarFichasDto,
  CrearOpcionDto,
} from './dto';

/**
 * Gestión de personal (listas SCTR).
 *
 * Un solo controller para periodos, grupos, fichas y catálogo: son
 * cuatro recursos de UNA pantalla y siempre se usan juntos. Cada uno
 * tiene su service, que es donde está la lógica.
 */
@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('gestion-personal')
export class GestionPersonalController {
  constructor(
    private readonly periodos: PeriodoService,
    private readonly grupos: GrupoService,
    private readonly fichas: FichaService,
    private readonly catalogo: CatalogoService,
  ) {}

  // ── Periodos ──

  // GET /gestion-personal/periodo?tipo=SUPERVISOR
  @Get('periodo')
  listarPeriodos(@Query('tipo') tipo?: string) {
    return this.periodos.listar(tipo);
  }

  // GET /gestion-personal/periodo/2026/7/CONTRATISTA
  @Get('periodo/:anio/:mes/:tipo')
  detallePeriodo(
    @Param('anio') anio: string,
    @Param('mes') mes: string,
    @Param('tipo') tipo: string,
  ) {
    return this.periodos.detalle(anio, mes, tipo);
  }

  @Post('periodo')
  crearPeriodo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearPeriodoDto,
  ) {
    return this.periodos.crear(usuario, dto);
  }

  @Post('periodo/copiar')
  copiarPeriodo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CopiarPeriodoDto,
  ) {
    return this.periodos.copiar(usuario, dto);
  }

  @Patch('periodo/:id/color')
  cambiarColor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { colorGrupo?: string | null },
  ) {
    return this.periodos.editarColor(id, dto.colorGrupo);
  }

  @Delete('periodo/:id')
  eliminarPeriodo(@Param('id', ParseIntPipe) id: number) {
    return this.periodos.eliminar(id);
  }

  // ── Grupos ──

  @Post('grupo')
  crearGrupo(@Body() dto: CrearGrupoDto) {
    return this.grupos.crear(dto);
  }

  @Patch('grupo/:id')
  editarGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarGrupoDto,
  ) {
    return this.grupos.editar(id, dto);
  }

  @Delete('grupo/:id')
  eliminarGrupo(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.eliminar(id);
  }

  // ── Fichas ──
  // OJO: las rutas literales van ANTES de :id, si no ParseIntPipe
  // rechaza "mover" y "eliminar".

  @Post('ficha/mover')
  moverFichas(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: MoverFichasDto,
  ) {
    return this.fichas.mover(usuario, dto);
  }

  @Post('ficha/eliminar')
  eliminarFichas(@Body() dto: EliminarFichasDto) {
    return this.fichas.eliminar(dto);
  }

  @Post('ficha')
  crearFicha(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearFichaDto,
  ) {
    return this.fichas.crear(usuario, dto);
  }

  @Post('ficha/:id/duplicar')
  duplicarFicha(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.fichas.duplicar(usuario, id);
  }

  @Patch('ficha/:id')
  editarFicha(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarFichaDto,
  ) {
    return this.fichas.editar(usuario, id, dto);
  }

  // ── Catálogo ──

  @Get('catalogo')
  listarCatalogo() {
    return this.catalogo.listar();
  }

  @Post('catalogo')
  crearOpcion(@Body() dto: CrearOpcionDto) {
    return this.catalogo.crear(dto);
  }

  @Delete('catalogo/:id')
  eliminarOpcion(@Param('id', ParseIntPipe) id: number) {
    return this.catalogo.eliminar(id);
  }
}
