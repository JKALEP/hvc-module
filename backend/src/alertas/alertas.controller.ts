import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { RequiereModulo } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';

@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertas: AlertasService) {}

  // GET /alertas?desde=&hasta=&proyectoId=&empresaId=&trabajadorId=&supervisorId=&estadoProyecto=
  //
  // Los filtros de proyecto/estado/supervisor acotan las alertas DE OBRA;
  // los de empresa/trabajador, las DE PLANILLA. No se cruzan: "este
  // trabajador no participó" es una pregunta sobre la nómina, no sobre
  // una obra.
  @Get()
  listar(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('proyectoId', new ParseIntPipe({ optional: true }))
    proyectoId?: number,
    @Query('empresaId', new ParseIntPipe({ optional: true }))
    empresaId?: number,
    @Query('trabajadorId', new ParseIntPipe({ optional: true }))
    trabajadorId?: number,
    @Query('supervisorId', new ParseIntPipe({ optional: true }))
    supervisorId?: number,
    @Query('estadoProyecto') estadoProyecto?: string,
  ) {
    return this.alertas.alertas({
      desde,
      hasta,
      proyectoId,
      empresaId,
      trabajadorId,
      supervisorId,
      estadoProyecto,
    });
  }

  // GET /alertas/cruce?proyectoId=2&desde=&hasta=
  // Vista Proyecto → Personal participante → Empresa → Utilización.
  @Get('cruce')
  cruce(
    @Query('proyectoId', ParseIntPipe) proyectoId: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('trabajadorId', new ParseIntPipe({ optional: true }))
    trabajadorId?: number,
  ) {
    return this.alertas.cruce(proyectoId, { desde, hasta, trabajadorId });
  }
}
