import { Controller, Get, Query } from '@nestjs/common';
import { MaestroService } from './maestro.service';
import { RequiereModulo } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';

@RequiereModulo(Modulo.COSTOS)
@Controller('maestro')
export class MaestroController {
  constructor(private readonly maestro: MaestroService) {}

  // GET /maestro?q=texto
  @Get()
  buscar(@Query('q') q?: string) {
    return this.maestro.buscar(q);
  }
}
