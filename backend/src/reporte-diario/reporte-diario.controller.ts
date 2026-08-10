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
import { ReporteDiarioService } from './reporte-diario.service';
import type { CrearReporteDiarioDto, EditarReporteDiarioDto } from './dto';
import { RequiereModulo } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';

@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('reporte-diario')
export class ReporteDiarioController {
  constructor(private readonly reporte: ReporteDiarioService) {}

  // GET /reporte-diario?proyectoId=1&supervisorId=2&desde=2026-08-01&hasta=2026-08-31
  @Get()
  listar(
    @Query('proyectoId', new ParseIntPipe({ optional: true }))
    proyectoId?: number,
    @Query('supervisorId', new ParseIntPipe({ optional: true }))
    supervisorId?: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.reporte.listar({ proyectoId, supervisorId, desde, hasta });
  }

  // Detalle con las participaciones y sus trabajadores.
  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.reporte.detalle(id);
  }

  // Crea reporte + N participaciones en una sola transacción.
  @Post()
  crear(@Body() dto: CrearReporteDiarioDto) {
    return this.reporte.crear(dto);
  }

  // Reescribe el reporte y regenera sus participaciones.
  @Put(':id')
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarReporteDiarioDto,
  ) {
    return this.reporte.editar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.reporte.eliminar(id);
  }
}
