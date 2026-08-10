import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { IndicadoresService } from './indicadores.service';
import { IndicadoresMensualService } from './indicadores-mensual.service';
import { RequiereModulo } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';

@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('indicadores')
export class IndicadoresController {
  constructor(
    private readonly indicadores: IndicadoresService,
    private readonly mensual: IndicadoresMensualService,
  ) {}

  // GET /indicadores/personal?desde=2026-08-01&hasta=2026-08-31&empresaId=1&proyectoId=2
  // Modo "Fechas": un período libre, sin desglose mensual.
  @Get('personal')
  personal(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('empresaId', new ParseIntPipe({ optional: true }))
    empresaId?: number,
    @Query('proyectoId', new ParseIntPipe({ optional: true }))
    proyectoId?: number,
  ) {
    return this.indicadores.personal({ desde, hasta, empresaId, proyectoId });
  }

  // GET /indicadores/personal-mensual?desdeMes=2026-01&hastaMes=2026-07&…
  // Modo "Meses": mismas secciones, desglosadas mes a mes.
  @Get('personal-mensual')
  personalMensual(
    @Query('desdeMes') desdeMes?: string,
    @Query('hastaMes') hastaMes?: string,
    @Query('empresaId', new ParseIntPipe({ optional: true }))
    empresaId?: number,
    @Query('proyectoId', new ParseIntPipe({ optional: true }))
    proyectoId?: number,
  ) {
    return this.mensual.personal({
      desdeMes,
      hastaMes,
      empresaId,
      proyectoId,
    });
  }

  // Detalle de una contratista: sus trabajadores con días por mes.
  // Alimenta la fila expandible de la tabla de utilización por empresa.
  @Get('empresa/:id/mensual')
  empresaMensual(
    @Param('id', ParseIntPipe) id: number,
    @Query('desdeMes') desdeMes?: string,
    @Query('hastaMes') hastaMes?: string,
    @Query('proyectoId', new ParseIntPipe({ optional: true }))
    proyectoId?: number,
  ) {
    return this.mensual.empresa(id, { desdeMes, hastaMes, proyectoId });
  }
}
