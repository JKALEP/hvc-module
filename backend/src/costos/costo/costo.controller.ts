import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { BaseCostosService } from './base-costos.service';
import { RegistroCostoService } from './registro-costo.service';
import {
  RequiereModulo,
  RequiereRolCostos,
  UsuarioActual,
} from '../../auth/decoradores';
import { Modulo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type { RegistrarCostoDto } from './dto';

/**
 * El costo: registrarlo (§47-51) y consultarlo (§52).
 *
 * Registrar es del SOLICITANTE —§46: tras la aprobación la tarea vuelve
 * a quien pidió—. Leer no lleva rol: la Base de Costos la consultan los
 * tres, porque «¿cuánto costó esto la última vez?» se la pregunta lo
 * mismo quien pide que quien cotiza o quien aprueba.
 */
@RequiereModulo(Modulo.COSTOS)
@Controller('costos')
export class CostoController {
  constructor(
    private readonly baseCostos: BaseCostosService,
    private readonly registro: RegistroCostoService,
  ) {}

  /** GET /costos/base?q=texto&pagina=1 — el histórico de §52. */
  @Get('base')
  base(@Query('q') q?: string, @Query('pagina') pagina?: string) {
    return this.baseCostos.buscar({ q, pagina: Number(pagina) });
  }

  /** §48-49: la plantilla con el proveedor y los ítems ya cargados. */
  @Get('requerimiento/:id/costo/plantilla')
  plantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.registro.plantilla(usuario, id);
  }

  @Get('requerimiento/:id/costo')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.registro.detalle(usuario, id);
  }

  /** §51. Cierra el requerimiento: pasa a FINALIZADO. */
  @Post('requerimiento/:id/costo')
  @RequiereRolCostos('SOLICITANTE')
  registrar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarCostoDto,
  ) {
    return this.registro.registrar(usuario, id, dto);
  }

  /** Corrige una errata. No cambia el estado ni el proveedor. */
  @Patch('requerimiento/:id/costo')
  @RequiereRolCostos('SOLICITANTE')
  editar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarCostoDto,
  ) {
    return this.registro.editar(usuario, id, dto);
  }
}
