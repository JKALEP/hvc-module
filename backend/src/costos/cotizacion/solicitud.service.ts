import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { CorreoService } from '../../common/correo.service';
import { aId } from '../../common/validacion';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PlantillaService } from '../plantilla/plantilla.service';
import { RequerimientoService } from '../requerimiento/requerimiento.service';

/** Un día calendario en el formato que lee una persona. */
function dia(f: Date): string {
  return f.toISOString().slice(0, 10).split('-').reverse().join('/');
}

/**
 * Compartir el requerimiento con proveedores (§30-33).
 *
 * Una fila por proveedor y por envío, con el correo al que fue, cuándo,
 * quién lo mandó y si salió. §33 lo pide entero, y §67 insiste en
 * guardar el error: sin esa columna, un envío caído solo se nota porque
 * nadie responde.
 *
 * SIN unicidad proveedor+requerimiento: §44 admite volver a pedirle al
 * mismo proveedor en una segunda vuelta, y §33 avisa de que no hay que
 * asumir que todos responderán.
 *
 * El envío NO tumba la operación si falla. La solicitud se guarda igual,
 * marcada FALLIDO y con el motivo: lo importante es que quede constancia
 * de a quién se le quiso pedir. Reintentar es volver a compartir.
 */
@Injectable()
export class SolicitudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly auditoria: AuditoriaService,
    private readonly plantillas: PlantillaService,
    private readonly requerimientos: RequerimientoService,
  ) {}

  async listar(usuario: UsuarioAutenticado, requerimientoId: number) {
    await this.requerimientos.detalle(usuario, requerimientoId);

    return this.prisma.solicitudCotizacion.findMany({
      where: { requerimientoId },
      orderBy: [{ creadoEn: 'desc' }],
      include: {
        proveedor: {
          select: { id: true, razonSocial: true, ruc: true, correo: true },
        },
        enviadoPor: { select: { id: true, nombre: true } },
        _count: { select: { cotizaciones: true } },
      },
    });
  }

  /** Los ids que llegan del selector de §30, ya validados y sin repetidos. */
  private aIds(valor: unknown): number[] {
    if (!Array.isArray(valor) || valor.length === 0)
      throw new BadRequestException(
        'Elige al menos un proveedor a quien pedirle cotización.',
      );

    const ids = valor.map((v) => aId(v, 'El proveedor no es válido.'));
    return [...new Set(ids)];
  }

  /**
   * Manda la solicitud a los proveedores elegidos.
   *
   * Se comprueba TODO antes de mandar nada: que los proveedores existan,
   * estén activos y tengan correo. Si uno falla, no sale ninguno — media
   * tanda enviada obligaría a adivinar a quién le llegó.
   */
  async compartir(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    proveedorIds: unknown,
  ) {
    const ids = this.aIds(proveedorIds);

    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    const proveedores = await this.prisma.proveedor.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        razonSocial: true,
        correo: true,
        estado: true,
      },
    });

    if (proveedores.length !== ids.length)
      throw new BadRequestException(
        'Alguno de los proveedores elegidos ya no existe.',
      );

    const inactivo = proveedores.find((p) => p.estado !== 'ACTIVO');
    if (inactivo)
      throw new BadRequestException(
        `"${inactivo.razonSocial}" está desactivado y no se le puede pedir cotización.`,
      );

    // Sin correo no hay a dónde mandar. Se corta aquí y no se guarda una
    // solicitud FALLIDA: es un dato que falta en la ficha del proveedor,
    // no un envío que salió mal.
    const sinCorreo = proveedores.find((p) => !p.correo);
    if (sinCorreo)
      throw new BadRequestException(
        `"${sinCorreo.razonSocial}" no tiene correo registrado. ` +
          'Complétalo en su ficha antes de pedirle cotización.',
      );

    const tabla = this.plantillas.tablaDeItems(req.items);
    const creadas: { proveedor: string; enviado: boolean }[] = [];

    for (const p of proveedores) {
      const { versionId, asunto, cuerpo } = await this.plantillas.resolver({
        numero_requerimiento: req.numero ?? '(sin número)',
        cliente: req.clienteNombre,
        lugar_entrega: req.lugarEntrega,
        fecha_entrega: dia(req.fechaEntrega),
        proveedor: p.razonSocial,
        usuario: usuario.nombre,
        items: tabla,
      });

      const resultado = await this.correo.enviarSolicitudCotizacion({
        para: p.correo as string,
        asunto,
        cuerpo,
      });

      await this.prisma.$transaction(async (tx) => {
        const solicitud = await tx.solicitudCotizacion.create({
          data: {
            requerimientoId,
            proveedorId: p.id,
            // Congelado: el correo del proveedor puede cambiar mañana y
            // esto tiene que seguir diciendo a dónde fue.
            destinatario: p.correo as string,
            plantillaVersionId: versionId,
            estadoEnvio: resultado.enviado ? 'ENVIADO' : 'FALLIDO',
            errorEnvio: resultado.error,
            enviadoPorId: usuario.id,
            enviadoEn: resultado.enviado ? new Date() : null,
          },
        });

        await this.auditoria.registrarUno(
          usuario,
          {
            requerimientoId,
            entidad: 'SOLICITUD_COTIZACION',
            entidadId: solicitud.id,
            accion: 'ENVIO_CORREO',
            descripcion: `Se pidió cotización a ${p.razonSocial} (${p.correo}).`,
            motivo: resultado.error,
          },
          tx,
        );
      });

      creadas.push({ proveedor: p.razonSocial, enviado: resultado.enviado });
    }

    // El estado cambia UNA vez, después de mandar todo. Si ya estaba en
    // PENDIENTE_COTIZACION, la transición no hace nada — que es lo
    // correcto cuando se suman proveedores a los que ya se les pidió.
    await this.prisma.$transaction(async (tx) => {
      await this.requerimientos.aplicarTransicion(
        usuario,
        tx,
        req,
        'PASAR_A_COTIZACION',
      );
    });

    return {
      solicitudes: creadas,
      // Se dice explícitamente que no salió ningún correo de verdad, en
      // vez de dejar que la pantalla lo dé por hecho.
      correoConfigurado: this.correo.configurado,
    };
  }
}
