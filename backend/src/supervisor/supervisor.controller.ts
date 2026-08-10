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
import { SupervisorService } from './supervisor.service';
import { SupervisorAnaliticaService } from './supervisor-analitica.service';
import type {
  CrearSupervisorDto,
  EditarSupervisorDto,
} from './supervisor.service';
import { RequiereModulo } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';

@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('supervisor')
export class SupervisorController {
  constructor(
    private readonly supervisor: SupervisorService,
    private readonly analitica: SupervisorAnaliticaService,
  ) {}

  // GET /supervisor?estado=ACTIVO|INACTIVO|TODOS&q=texto
  @Get()
  listar(@Query('estado') estado?: string, @Query('q') q?: string) {
    return this.supervisor.listar(estado, q);
  }

  // OJO: antes de :id, si no ParseIntPipe rechaza "comparacion".
  // GET /supervisor/comparacion?desde=&hasta=
  @Get('comparacion')
  comparacion(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.analitica.comparacion({ desde, hasta });
  }

  // GET /supervisor/:id/resumen?desde=&hasta=
  // Obras que ha llevado (histórico) + desempeño del período.
  @Get(':id/resumen')
  resumen(
    @Param('id', ParseIntPipe) id: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analitica.resumen(id, { desde, hasta });
  }

  @Post()
  crear(@Body() dto: CrearSupervisorDto) {
    return this.supervisor.crear(dto);
  }

  @Put(':id')
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarSupervisorDto,
  ) {
    return this.supervisor.editar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.supervisor.eliminar(id);
  }
}
