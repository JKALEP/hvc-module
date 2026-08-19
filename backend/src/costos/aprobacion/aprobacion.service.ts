import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DecisionAprobacion } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { limpiar, describir } from '../../common/texto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { RequerimientoService } from '../requerimiento/requerimiento.service';
import type { AccionRequerimiento } from '../requerimiento/estados';
import { aTexto } from '../validacion';
import type { DecidirDto } from './dto';

/** Qué acción de la máquina de estados dispara cada decisión. */
const ACCION: Record<DecisionAprobacion, AccionRequerimiento> = {
  ACEPTADA: 'ACEPTAR',
  RECHAZADA: 'RECHAZAR',
  SIN_ACUERDO: 'CERRAR_SIN_ACUERDO',
};

/**
 * La decisión del Aprobador (§40-45).
 *
 * Una fila POR DECISIÓN y no una por requerimiento: §44 admite rechazo →
 * nueva evaluación → nueva decisión, y «se aprobó a la segunda» es
 * información. Sobrescribir la primera decisión la borraría.
 *
 * Cada decisión se ata a la EVALUACIÓN sobre la que se pronunció, no
 * solo al requerimiento. Es lo que permite leer el expediente y saber
 * qué recomendación concreta se rechazó y con qué justificación se había
 * elevado — y es también lo que le dice al Gestor, cuando vuelve a
 * recomendar, si está corrigiendo o abriendo vuelta nueva.
 */
@Injectable()
export class AprobacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly requerimientos: RequerimientoService,
  ) {}

  private aDecision(valor: unknown): DecisionAprobacion {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(DecisionAprobacion) as string[];
    if (s && validos.includes(s)) return s as DecisionAprobacion;
    throw new BadRequestException(
      `Decisión inválida: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  /** Las decisiones de un requerimiento, de la más reciente hacia atrás. */
  async listar(usuario: UsuarioAutenticado, requerimientoId: number) {
    await this.requerimientos.detalle(usuario, requerimientoId);

    return this.prisma.aprobacion.findMany({
      where: { requerimientoId },
      orderBy: [{ creadoEn: 'desc' }],
      include: {
        aprobador: { select: { id: true, nombre: true } },
        evaluacion: {
          select: {
            id: true,
            ronda: true,
            justificacion: true,
            cotizacion: {
              select: {
                id: true,
                proveedor: { select: { id: true, razonSocial: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * El Aprobador se pronuncia (§41-45).
   *
   * Aceptar deja la cotización recomendada como APROBADA y el
   * requerimiento esperando que el Solicitante registre el costo — el
   * turno cambia de dueño, que es lo único que un estado tiene que decir.
   *
   * Rechazar NO cierra (§43): marca esa cotización como RECHAZADA y
   * devuelve el requerimiento al Gestor, que puede volver a evaluar
   * cuantas vueltas hagan falta (§44). La cotización rechazada sigue
   * disponible: si en la vuelta siguiente el Gestor la vuelve a
   * recomendar con mejor justificación, se puede.
   *
   * Cerrar sin acuerdo (§45) sí cierra, y se puede desde antes de que
   * haya nada que aprobar: existe justamente para cuando no se llegó a
   * acuerdo con los proveedores, y eso se sabe sin necesidad de una
   * recomendación.
   */
  async decidir(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    dto: DecidirDto,
  ) {
    const decision = this.aDecision(dto.decision);
    const accion = ACCION[decision];

    // §43 y §45 devuelven o cierran: sin motivo, el Gestor no sabe qué
    // corregir y el Solicitante no sabe por qué se quedó sin nada.
    const comentario =
      decision === 'ACEPTADA'
        ? limpiar(dto.comentario)
        : aTexto(
            dto.comentario,
            decision === 'RECHAZADA'
              ? 'El motivo del rechazo'
              : 'El motivo del cierre sin acuerdo',
          );

    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      select: { id: true, estado: true, numero: true },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    // La recomendación vigente es la de ronda más alta. Puede no haberla:
    // cerrar sin acuerdo no exige que nadie haya recomendado nada.
    const evaluacion = await this.prisma.evaluacionCotizacion.findFirst({
      where: { requerimientoId },
      orderBy: { ronda: 'desc' },
      include: {
        cotizacion: {
          include: { proveedor: { select: { razonSocial: true } } },
        },
      },
    });

    if (decision !== 'SIN_ACUERDO' && !evaluacion)
      throw new BadRequestException(
        'No hay ninguna recomendación sobre la que decidir.',
      );

    await this.prisma.$transaction(async (tx) => {
      const aprobacion = await tx.aprobacion.create({
        data: {
          requerimientoId,
          evaluacionId: evaluacion?.id ?? null,
          decision,
          comentario: comentario ?? null,
          aprobadorId: usuario.id,
        },
      });

      // La cotización sigue a su decisión. Solo la recomendada: las demás
      // no se tocan, siguen siendo alternativas que constan en el
      // expediente.
      if (evaluacion && decision !== 'SIN_ACUERDO')
        await tx.cotizacionProveedor.update({
          where: { id: evaluacion.cotizacionId },
          data: {
            estado: decision === 'ACEPTADA' ? 'APROBADA' : 'RECHAZADA',
          },
        });

      const sobre = evaluacion
        ? ` la cotización de ${evaluacion.cotizacion.proveedor.razonSocial} (ronda ${evaluacion.ronda})`
        : '';

      await this.auditoria.registrarUno(
        usuario,
        {
          requerimientoId,
          entidad: 'APROBACION',
          entidadId: aprobacion.id,
          accion: 'DECISION',
          valorNuevo: decision,
          motivo: comentario ?? null,
          descripcion:
            decision === 'ACEPTADA'
              ? `Se aceptó${sobre}.`
              : decision === 'RECHAZADA'
                ? `Se rechazó${sobre}.`
                : 'Se cerró el requerimiento sin acuerdo.',
        },
        tx,
      );

      await this.requerimientos.aplicarTransicion(
        usuario,
        tx,
        req,
        accion,
        comentario ?? null,
      );
    });

    return this.requerimientos.detalle(usuario, requerimientoId);
  }
}
