import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aId } from '../../common/validacion';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { RequerimientoService } from '../requerimiento/requerimiento.service';
import { aTexto } from '../validacion';
import type { RecomendarDto } from './dto';

/** Lo mínimo que tiene que escribir el Gestor para justificar (§39). */
const MINIMO_JUSTIFICACION = 15;

/**
 * La recomendación del Gestor (§38-39).
 *
 * La distinción de §38 es la razón de ser de este service: el Gestor
 * SELECCIONA y RECOMIENDA; no aprueba. La cotización queda RECOMENDADA,
 * nunca APROBADA — eso solo lo hace el Aprobador, en la Fase 5.
 *
 * Cada recomendación es una fila de `EvaluacionCotizacion` con su
 * `ronda`. §44 admite que el Aprobador rechace y el Gestor vuelva a
 * evaluar cuantas veces haga falta, y guardar solo la última borraría por
 * qué se había recomendado la anterior. La VIGENTE es la de ronda más
 * alta, calculada en lectura: un booleano habría que apagarlo a mano y
 * algún día habría dos vigentes a la vez.
 */
@Injectable()
export class EvaluacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly requerimientos: RequerimientoService,
  ) {}

  /** Las recomendaciones de un requerimiento, la más reciente primero. */
  async listar(usuario: UsuarioAutenticado, requerimientoId: number) {
    await this.requerimientos.detalle(usuario, requerimientoId);

    return this.prisma.evaluacionCotizacion.findMany({
      where: { requerimientoId },
      orderBy: [{ ronda: 'desc' }],
      include: {
        gestor: { select: { id: true, nombre: true } },
        cotizacion: {
          include: {
            proveedor: { select: { id: true, razonSocial: true, ruc: true } },
          },
        },
      },
    });
  }

  /**
   * El Gestor marca que está comparando (§37).
   *
   * Existe como acción explícita porque §11 pide saber exactamente dónde
   * está el proceso: «hay cotizaciones sobre la mesa» y «alguien las está
   * mirando» son dos sitios distintos, y el segundo le dice al Solicitante
   * que su requerimiento no está parado.
   */
  async evaluar(usuario: UsuarioAutenticado, requerimientoId: number) {
    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      select: { id: true, estado: true },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    await this.prisma.$transaction(async (tx) => {
      await this.requerimientos.aplicarTransicion(usuario, tx, req, 'EVALUAR');
    });

    return this.requerimientos.detalle(usuario, requerimientoId);
  }

  /**
   * Vuelve a evaluar tras un rechazo (§44).
   *
   * No borra nada: la recomendación anterior y la decisión que la rechazó
   * siguen ahí, y la siguiente recomendación será la ronda 2.
   */
  async reevaluar(usuario: UsuarioAutenticado, requerimientoId: number) {
    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      select: { id: true, estado: true },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    await this.prisma.$transaction(async (tx) => {
      await this.requerimientos.aplicarTransicion(
        usuario,
        tx,
        req,
        'REEVALUAR',
      );
    });

    return this.requerimientos.detalle(usuario, requerimientoId);
  }

  /**
   * Recomienda una cotización, con justificación obligatoria (§39).
   *
   * La justificación tiene mínimo: §39 pide explicar ventajas,
   * comparación y motivo de elección, y un «ok» de dos letras no es eso.
   * Es lo que el Aprobador lee para decidir (§40), así que si está vacía
   * el requerimiento llega a su mesa sin el único dato que le pedimos al
   * Gestor.
   */
  async recomendar(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    dto: RecomendarDto,
  ) {
    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      select: { id: true, estado: true },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    const cotizacionId = aId(dto.cotizacionId, 'La cotización no es válida.');
    const justificacion = aTexto(dto.justificacion, 'La justificación');

    if (justificacion.length < MINIMO_JUSTIFICACION)
      throw new BadRequestException(
        `La justificación es demasiado corta: escribe al menos ${MINIMO_JUSTIFICACION} caracteres. ` +
          'Es lo que el Aprobador va a leer para decidir.',
      );

    const cotizacion = await this.prisma.cotizacionProveedor.findFirst({
      where: { id: cotizacionId, requerimientoId },
      include: { proveedor: { select: { razonSocial: true } } },
    });
    if (!cotizacion)
      throw new BadRequestException(
        'Esa cotización no es de este requerimiento.',
      );

    if (cotizacion.estado === 'DESCARTADA')
      throw new BadRequestException(
        'Esa cotización está descartada: no se puede recomendar.',
      );

    // §54: un ítem cambió después de recibirla, así que puso precio a
    // otra cosa. Elevarla al Aprobador sería pedirle que decida sobre un
    // número que ya no corresponde a lo que se pide.
    if (cotizacion.requiereRevision)
      throw new BadRequestException(
        `Esa cotización quedó pendiente de revisar: ${cotizacion.revisionMotivo ?? 'cambió lo que se pide.'} ` +
          `Vuelve a pedirle precio a ${cotizacion.proveedor.razonSocial} y actualízala antes de recomendarla.`,
      );

    /**
     * ¿Esto abre una vuelta nueva o corrige la de ahora?
     *
     * Lo decide un hecho, no un parámetro: si la evaluación vigente ya
     * tiene una `Aprobacion`, el Aprobador se pronunció y lo que venga
     * después es la vuelta siguiente del ciclo de §44. Si no se ha
     * pronunciado, el Gestor está corrigiendo lo suyo antes de que nadie
     * lo mire, y eso no es una vuelta: sería inflar el contador con
     * erratas y hacer ilegible «se aprobó a la tercera».
     */
    const vigente = await this.prisma.evaluacionCotizacion.findFirst({
      where: { requerimientoId },
      orderBy: { ronda: 'desc' },
      include: {
        _count: { select: { aprobaciones: true } },
        cotizacion: {
          include: { proveedor: { select: { razonSocial: true } } },
        },
      },
    });

    const corrige = vigente !== null && vigente._count.aprobaciones === 0;
    const ronda = corrige ? vigente.ronda : (vigente?.ronda ?? 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      // Solo una RECOMENDADA a la vez. La anterior vuelve a REGISTRADA:
      // sigue siendo una alternativa válida que el Aprobador puede ver
      // (§40), simplemente ya no es la elegida.
      await tx.cotizacionProveedor.updateMany({
        where: { requerimientoId, estado: 'RECOMENDADA' },
        data: { estado: 'REGISTRADA' },
      });

      await tx.cotizacionProveedor.update({
        where: { id: cotizacionId },
        data: { estado: 'RECOMENDADA' },
      });

      if (corrige) {
        // Se sustituye la fila de esta vuelta. Lo anterior no se pierde:
        // va a la bitácora con su valor viejo y su valor nuevo, que es
        // exactamente para lo que existe (§53).
        await tx.evaluacionCotizacion.update({
          where: { id: vigente.id },
          data: { cotizacionId, justificacion, gestorId: usuario.id },
        });

        await this.auditoria.registrar(
          usuario,
          [
            ...(vigente.cotizacionId !== cotizacionId
              ? [
                  {
                    requerimientoId,
                    entidad: 'EVALUACION' as const,
                    entidadId: vigente.id,
                    accion: 'EDICION' as const,
                    campoAfectado: 'cotizacion',
                    valorAnterior: vigente.cotizacion.proveedor.razonSocial,
                    valorNuevo: cotizacion.proveedor.razonSocial,
                  },
                ]
              : []),
            ...(vigente.justificacion !== justificacion
              ? [
                  {
                    requerimientoId,
                    entidad: 'EVALUACION' as const,
                    entidadId: vigente.id,
                    accion: 'EDICION' as const,
                    campoAfectado: 'justificacion',
                    valorAnterior: vigente.justificacion,
                    valorNuevo: justificacion,
                  },
                ]
              : []),
          ],
          tx,
        );
      } else {
        const evaluacion = await tx.evaluacionCotizacion.create({
          data: {
            requerimientoId,
            cotizacionId,
            ronda,
            justificacion,
            gestorId: usuario.id,
          },
        });

        await this.auditoria.registrarUno(
          usuario,
          {
            requerimientoId,
            entidad: 'EVALUACION',
            entidadId: evaluacion.id,
            accion: 'RECOMENDACION',
            descripcion:
              `Ronda ${ronda}: se recomendó la cotización de ` +
              `${cotizacion.proveedor.razonSocial}.`,
            motivo: justificacion,
          },
          tx,
        );
      }

      await this.requerimientos.aplicarTransicion(
        usuario,
        tx,
        req,
        'RECOMENDAR',
      );
    });

    return this.requerimientos.detalle(usuario, requerimientoId);
  }
}
