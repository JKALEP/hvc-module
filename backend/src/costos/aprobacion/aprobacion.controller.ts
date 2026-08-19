import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { AprobacionService } from './aprobacion.service';
import {
  RequiereModulo,
  RequiereRolCostos,
  UsuarioActual,
} from '../../auth/decoradores';
import { Modulo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type { DecidirDto } from './dto';

/**
 * Las decisiones del Aprobador (§41-45).
 *
 * Lo que §40 pide ver antes de decidir —requerimiento, ítems, TODAS las
 * cotizaciones, la recomendada y su justificación— ya lo dan tres
 * endpoints que existen: `/requerimiento/:id`,
 * `/requerimiento/:id/comparacion` y `/requerimiento/:id/evaluacion`. No
 * se añade un cuarto que devuelva la unión de los tres: sería otra
 * definición de lo mismo, y la pantalla puede pedirlos a la vez.
 */
@RequiereModulo(Modulo.COSTOS)
@Controller('costos')
export class AprobacionController {
  constructor(private readonly aprobaciones: AprobacionService) {}

  /** El historial de decisiones, incluidas las vueltas de §44. */
  @Get('requerimiento/:id/aprobacion')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.aprobaciones.listar(usuario, id);
  }

  /** ACEPTADA / RECHAZADA / SIN_ACUERDO. Las dos últimas exigen motivo. */
  @Post('requerimiento/:id/decision')
  @RequiereRolCostos('APROBADOR')
  decidir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecidirDto,
  ) {
    return this.aprobaciones.decidir(usuario, id, dto);
  }
}
