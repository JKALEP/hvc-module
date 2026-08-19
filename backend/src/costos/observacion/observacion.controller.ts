import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ObservacionService } from './observacion.service';
import {
  RequiereModulo,
  RequiereRolCostos,
  UsuarioActual,
} from '../../auth/decoradores';
import { Modulo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type { CrearObservacionDto, ConfirmarObservacionDto } from './dto';

/**
 * Observaciones (§27-29).
 *
 * Es el único recurso del módulo donde dos roles distintos escriben:
 * el Gestor la emite, el Solicitante la confirma. Por eso el rol va
 * método a método y no en la clase.
 *
 * Las rutas cuelgan de `costos/` y no de `costos/requerimiento` porque
 * `confirmar` actúa sobre la observación, no sobre el requerimiento. Las
 * dos primeras sí van anidadas: una observación no existe fuera de su
 * requerimiento.
 */
@RequiereModulo(Modulo.COSTOS)
@Controller('costos')
export class ObservacionController {
  constructor(private readonly observaciones: ObservacionService) {}

  @Get('requerimiento/:id/observacion')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.observaciones.listar(usuario, id);
  }

  /** §27. Devuelve el requerimiento al Solicitante: pasa a OBSERVADO. */
  @Post('requerimiento/:id/observacion')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearObservacionDto,
  ) {
    return this.observaciones.crear(usuario, id, dto);
  }

  /** §29. Sin esto, `emitir` desde OBSERVADO se rechaza. */
  @Post('observacion/:observacionId/confirmar')
  @RequiereRolCostos('SOLICITANTE')
  confirmar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('observacionId', ParseIntPipe) observacionId: number,
    @Body() dto: ConfirmarObservacionDto,
  ) {
    return this.observaciones.confirmar(usuario, observacionId, dto);
  }
}
