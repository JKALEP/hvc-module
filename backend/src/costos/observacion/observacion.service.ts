import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { RequerimientoService } from '../requerimiento/requerimiento.service';
import { aTexto, aTextoOpcional } from '../validacion';
import type { CrearObservacionDto, ConfirmarObservacionDto } from './dto';

/**
 * Las observaciones del Gestor sobre un requerimiento (§27-29).
 *
 * El ciclo completo son tres actos de dos personas distintas: el Gestor
 * escribe qué falta, el Solicitante corrige, y el Solicitante deja
 * constancia de que lo leyó. Los tres quedan en la bitácora, porque §64
 * pide poder reconstruir exactamente esa ida y vuelta.
 *
 * La transición de estado NO se escribe aquí: se delega en
 * `RequerimientoService.aplicarTransicion`, que es el único sitio del
 * módulo donde se toca `costos_requerimientos.estado`.
 */
@Injectable()
export class ObservacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly requerimientos: RequerimientoService,
  ) {}

  /** Las de un requerimiento, de la más antigua a la más reciente. */
  async listar(usuario: UsuarioAutenticado, requerimientoId: number) {
    // Reutiliza el control de acceso del detalle: un Solicitante no lee
    // las observaciones de un requerimiento ajeno.
    await this.requerimientos.detalle(usuario, requerimientoId);

    return this.prisma.observacion.findMany({
      where: { requerimientoId },
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
      include: {
        creadoPor: { select: { id: true, nombre: true } },
        confirmadaPor: { select: { id: true, nombre: true } },
      },
    });
  }

  /**
   * El Gestor observa el requerimiento y se lo devuelve al Solicitante
   * (§27).
   *
   * Una observación por cada cosa que falta, no un texto que se
   * reescribe: §44 admite varias vueltas y §53 prohíbe perder lo
   * anterior. «Falta la cantidad del ítem 3» tiene que seguir ahí cuando
   * se lea el expediente dentro de un año.
   */
  async crear(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    dto: CrearObservacionDto,
  ) {
    const texto = aTexto(dto.texto, 'El texto de la observación');

    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      select: { id: true, estado: true, numero: true },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    return this.prisma.$transaction(async (tx) => {
      const observacion = await tx.observacion.create({
        data: { requerimientoId, texto, creadoPorId: usuario.id },
      });

      await this.auditoria.registrarUno(
        usuario,
        {
          requerimientoId,
          entidad: 'OBSERVACION',
          entidadId: observacion.id,
          accion: 'OBSERVACION_EMITIDA',
          descripcion: texto,
        },
        tx,
      );

      await this.requerimientos.aplicarTransicion(usuario, tx, req, 'OBSERVAR');

      return observacion;
    });
  }

  /**
   * El Solicitante deja constancia de que la revisó (§29).
   *
   * Registra quién, cuándo y —si escribió algo— qué contestó. Es lo que
   * abre la puerta a reemitir: sin esto, `emitir` desde OBSERVADO se
   * rechaza.
   *
   * No cambia el estado del requerimiento: sigue OBSERVADO hasta que el
   * Solicitante lo devuelva. Confirmar es acusar recibo, no corregir.
   */
  async confirmar(
    usuario: UsuarioAutenticado,
    observacionId: number,
    dto: ConfirmarObservacionDto,
  ) {
    const actual = await this.prisma.observacion.findUnique({
      where: { id: observacionId },
      include: {
        requerimiento: { select: { id: true, solicitanteId: true } },
      },
    });
    if (!actual) throw new NotFoundException('Esa observación ya no existe.');

    const rol =
      usuario.permisos.find((p) => p.modulo === 'COSTOS')?.rolCostos ?? null;
    if (
      rol === 'SOLICITANTE' &&
      actual.requerimiento.solicitanteId !== usuario.id
    )
      throw new ForbiddenException(
        'Esa observación es de un requerimiento de otra persona.',
      );

    if (actual.estado === 'ATENDIDA')
      throw new BadRequestException('Esa observación ya estaba confirmada.');

    const respuesta = aTextoOpcional(dto.respuesta);

    const observacion = await this.prisma.observacion.update({
      where: { id: observacionId },
      data: {
        estado: 'ATENDIDA',
        respuesta,
        confirmadaPorId: usuario.id,
        confirmadaEn: new Date(),
      },
    });

    await this.auditoria.registrarUno(usuario, {
      requerimientoId: actual.requerimientoId,
      entidad: 'OBSERVACION',
      entidadId: observacionId,
      accion: 'OBSERVACION_CONFIRMADA',
      descripcion: respuesta ?? 'Revisada y entendida.',
    });

    return observacion;
  }
}
