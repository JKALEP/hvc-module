import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ProyectoService } from './proyecto.service';
import { ProyectoAnaliticaService } from './proyecto-analitica.service';
import type {
  CrearProyectoDto,
  EditarProyectoDto,
  AjusteAvanceDto,
} from './proyecto.service';
import { RequiereModulo } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';

@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('proyecto')
export class ProyectoController {
  constructor(
    private readonly proyecto: ProyectoService,
    private readonly analitica: ProyectoAnaliticaService,
  ) {}

  // GET /proyecto?estado=EN_EJECUCION&q=texto
  @Get()
  listar(@Query('estado') estado?: string, @Query('q') q?: string) {
    return this.proyecto.listar(estado, q);
  }

  // OJO: debe ir ANTES de :id, si no ParseIntPipe rechaza "comparacion".
  // GET /proyecto/comparacion?desde=&hasta=
  @Get('comparacion')
  comparacion(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.analitica.comparacion({ desde, hasta });
  }

  // GET /proyecto/:id — incluye la serie completa de avances semanales
  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.proyecto.detalle(id);
  }

  @Post()
  crear(@Body() dto: CrearProyectoDto) {
    return this.proyecto.crear(dto);
  }

  @Put(':id')
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarProyectoDto,
  ) {
    return this.proyecto.editar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.proyecto.eliminar(id);
  }

  // ── Analítica (Fase 3) ──

  // Tarjeta ejecutiva. El avance acumulado NO depende de desde/hasta.
  @Get(':id/resumen')
  resumen(
    @Param('id', ParseIntPipe) id: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analitica.resumen(id, { desde, hasta });
  }

  // Serie para el gráfico de línea. produccion puede ser null.
  @Get(':id/produccion-diaria')
  produccionDiaria(
    @Param('id', ParseIntPipe) id: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analitica.produccionDiaria(id, { desde, hasta });
  }

  // Serie para el gráfico de barras agrupadas.
  @Get(':id/equipos')
  equipos(
    @Param('id', ParseIntPipe) id: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analitica.equipos(id, { desde, hasta });
  }

  // Serie para el ComposedChart (barras laborando + línea programados).
  @Get(':id/tecnicos')
  tecnicos(
    @Param('id', ParseIntPipe) id: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analitica.tecnicos(id, { desde, hasta });
  }

  // Serie del cumplimiento acumulado día a día + los ajustes manuales,
  // para el gráfico. El rango recorta lo que se dibuja, no lo que se acumula.
  @Get(':id/cumplimiento-acumulado')
  cumplimientoAcumulado(
    @Param('id', ParseIntPipe) id: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analitica.cumplimientoAcumulado(id, { desde, hasta });
  }

  // ── Ajustes manuales de avance (excepción, no rutina) ──

  @Get(':id/ajuste-avance')
  listarAjustes(@Param('id', ParseIntPipe) id: number) {
    return this.proyecto.listarAjustes(id);
  }

  // POST /proyecto/:id/ajuste-avance — crea un ajuste. La justificación es
  // obligatoria: sobrescribe el avance calculado y tiene que quedar explicado.
  @Post(':id/ajuste-avance')
  registrarAjuste(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjusteAvanceDto,
  ) {
    return this.proyecto.registrarAjuste(id, dto);
  }

  @Delete(':id/ajuste-avance/:ajusteId')
  eliminarAjuste(
    @Param('id', ParseIntPipe) id: number,
    @Param('ajusteId', ParseIntPipe) ajusteId: number,
  ) {
    return this.proyecto.eliminarAjuste(id, ajusteId);
  }
}
