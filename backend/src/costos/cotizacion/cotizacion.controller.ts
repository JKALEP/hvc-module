import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { SolicitudService } from './solicitud.service';
import { CotizacionService } from './cotizacion.service';
import { ComparacionService } from './comparacion.service';
import { EvaluacionService } from './evaluacion.service';
import {
  RequiereModulo,
  RequiereRolCostos,
  UsuarioActual,
} from '../../auth/decoradores';
import { Modulo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type {
  CompartirDto,
  GuardarCotizacionDto,
  EditarCotizacionDto,
  RecomendarDto,
} from './dto';
import type { MotivoDto } from '../requerimiento/dto';

/**
 * El trabajo del Gestor de cotizaciones (§30-39).
 *
 * Todas las ESCRITURAS son suyas. Las lecturas se dejan abiertas a los
 * tres roles a propósito: §40 dice que el Aprobador tiene que ver todas
 * las cotizaciones y la recomendación, y §26 que el Solicitante consulte
 * el estado de lo suyo. Quién ve QUÉ requerimiento lo acota
 * `RequerimientoService`, que es una regla de alcance y no de rol.
 */
@RequiereModulo(Modulo.COSTOS)
@Controller('costos')
export class CotizacionController {
  constructor(
    private readonly solicitudes: SolicitudService,
    private readonly cotizaciones: CotizacionService,
    private readonly comparacion: ComparacionService,
    private readonly evaluaciones: EvaluacionService,
  ) {}

  // ── Compartir con proveedores (§30-33) ──

  @Get('requerimiento/:id/solicitud')
  listarSolicitudes(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.solicitudes.listar(usuario, id);
  }

  /** §30-33. Manda el correo y deja constancia de a quién y con qué resultado. */
  @Post('requerimiento/:id/solicitud')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  compartir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompartirDto,
  ) {
    return this.solicitudes.compartir(usuario, id, dto?.destinos);
  }

  // ── Cotizaciones recibidas (§34-36) ──

  @Get('requerimiento/:id/cotizacion')
  listarCotizaciones(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cotizaciones.listar(usuario, id);
  }

  @Post('requerimiento/:id/cotizacion')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  registrarCotizacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarCotizacionDto,
  ) {
    return this.cotizaciones.crear(usuario, id, dto);
  }

  @Get('cotizacion/:cotizacionId')
  detalleCotizacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('cotizacionId', ParseIntPipe) cotizacionId: number,
  ) {
    return this.cotizaciones.detalle(usuario, cotizacionId);
  }

  @Patch('cotizacion/:cotizacionId')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  editarCotizacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('cotizacionId', ParseIntPipe) cotizacionId: number,
    @Body() dto: EditarCotizacionDto,
  ) {
    return this.cotizaciones.editar(usuario, cotizacionId, dto);
  }

  /**
   * La saca de la comparación sin borrarla: el Aprobador sigue viendo
   * que ese proveedor respondió y por qué se dejó fuera.
   */
  @Post('cotizacion/:cotizacionId/descartar')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  descartarCotizacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('cotizacionId', ParseIntPipe) cotizacionId: number,
    @Body() dto: MotivoDto,
  ) {
    return this.cotizaciones.descartar(
      usuario,
      cotizacionId,
      dto?.motivo ?? undefined,
    );
  }

  // ── Comparar (§37) ──

  /** Lo que §37 pide ver a la vez, más el desglose ítem por ítem. */
  @Get('requerimiento/:id/comparacion')
  comparar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.comparacion.comparar(usuario, id);
  }

  // ── Evaluar y recomendar (§38-39) ──

  @Get('requerimiento/:id/evaluacion')
  listarEvaluaciones(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.evaluaciones.listar(usuario, id);
  }

  @Post('requerimiento/:id/evaluar')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  evaluar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.evaluaciones.evaluar(usuario, id);
  }

  /** §44: vuelve a evaluar después de un rechazo, sin destruir lo anterior. */
  @Post('requerimiento/:id/reevaluar')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  reevaluar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.evaluaciones.reevaluar(usuario, id);
  }

  /** §38-39. Queda RECOMENDADA, nunca aprobada: eso es del Aprobador. */
  @Post('requerimiento/:id/recomendacion')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  recomendar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecomendarDto,
  ) {
    return this.evaluaciones.recomendar(usuario, id, dto);
  }
}
