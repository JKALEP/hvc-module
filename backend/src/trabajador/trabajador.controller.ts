import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { TrabajadorService } from './trabajador.service';
import { IndicadoresMensualService } from '../indicadores/indicadores-mensual.service';
import { RequiereModulo } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';

@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('trabajador')
export class TrabajadorController {
  constructor(
    private readonly trabajador: TrabajadorService,
    private readonly mensual: IndicadoresMensualService,
  ) {}

  // GET /trabajador?q=texto&empresaId=1&incluirInactivos=true
  @Get()
  buscar(
    @Query('q') q?: string,
    @Query('empresaId', new ParseIntPipe({ optional: true }))
    empresaId?: number,
    @Query('incluirInactivos', new ParseBoolPipe({ optional: true }))
    incluirInactivos?: boolean,
  ) {
    return this.trabajador.buscar(q, empresaId, incluirInactivos ?? false);
  }

  // OJO: debe ir ANTES de :id, si no ParseIntPipe rechaza "empresas".
  // GET /trabajador/empresas?estado=TODOS
  @Get('empresas')
  listarEmpresas(@Query('estado') estado?: string) {
    return this.trabajador.listarEmpresas(estado);
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.trabajador.detalle(id);
  }

  // GET /trabajador/:id/mensual?desdeMes=2026-01&hastaMes=2026-07&proyectoId=
  // Rendimiento mes a mes de una persona: días, % del mes, proyectos y la
  // empresa de cada mes (snapshot de participaciones y planilla).
  // Alimenta la fila expandible del ranking en /personal.
  @Get(':id/mensual')
  rendimientoMensual(
    @Param('id', ParseIntPipe) id: number,
    @Query('desdeMes') desdeMes?: string,
    @Query('hastaMes') hastaMes?: string,
    @Query('proyectoId', new ParseIntPipe({ optional: true }))
    proyectoId?: number,
  ) {
    return this.mensual.trabajador(id, { desdeMes, hastaMes, proyectoId });
  }
}
