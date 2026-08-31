import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { CorreoService } from '../../common/correo.service';
import { aId } from '../../common/validacion';
import { limpiar } from '../../common/texto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PlantillaService } from '../plantilla/plantilla.service';
import { RequerimientoService } from '../requerimiento/requerimiento.service';
import type { DestinoDto } from './dto';

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

  /**
   * Formato de correo. Deliberadamente laxo: aquí solo se descarta lo que
   * NO puede ser una dirección. Quién existe de verdad lo dice el servidor
   * de correo, y una expresión estricta rechaza direcciones válidas raras.
   */
  private static readonly FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /**
   * Los destinos que llegan del selector de §30, validados y sin repetir.
   *
   * Cada uno es un PROVEEDOR y, opcionalmente, la dirección a la que
   * mandarle esta vez. Sin dirección se usa la de su ficha.
   *
   * Se deduplica por proveedor y no por correo: pedirle dos veces al mismo
   * proveedor en un solo envío es un error de la pantalla, aunque las dos
   * direcciones sean distintas. La segunda vuelta de §44 es otro envío.
   */
  private aDestinos(
    valor: unknown,
  ): { proveedorId: number; correo: string | null }[] {
    if (!Array.isArray(valor) || valor.length === 0)
      throw new BadRequestException(
        'Elige al menos un proveedor a quien pedirle cotización.',
      );

    const porProveedor = new Map<number, string | null>();

    for (const crudo of valor as DestinoDto[]) {
      const id = aId(crudo?.proveedorId, 'El proveedor no es válido.');
      const correo = limpiar(crudo?.correo);

      if (correo && !SolicitudService.FORMATO_CORREO.test(correo))
        throw new BadRequestException(
          `"${correo}" no parece una dirección de correo.`,
        );

      // El primero gana: si la pantalla manda el mismo proveedor dos
      // veces, quedarse con el último escondería el duplicado.
      if (!porProveedor.has(id)) porProveedor.set(id, correo || null);
    }

    return [...porProveedor].map(([proveedorId, correo]) => ({
      proveedorId,
      correo,
    }));
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
    destinos: unknown,
  ) {
    const elegidos = this.aDestinos(destinos);
    const ids = elegidos.map((d) => d.proveedorId);
    const correoEscrito = new Map(
      elegidos.map((d) => [d.proveedorId, d.correo]),
    );

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

    /**
     * La dirección de cada envío: la escrita en el selector si la hay, y
     * si no la de la ficha.
     *
     * El correo escrito manda sobre el guardado a propósito. Cubre los dos
     * casos que traían al Gestor de cabeza: el proveedor que nunca tuvo
     * correo en su ficha —antes ni siquiera se podía marcar— y el que lo
     * tiene viejo y hoy responde por otro buzón.
     */
    const destinoDe = new Map<number, string>();
    for (const p of proveedores) {
      const direccion = correoEscrito.get(p.id) ?? p.correo;
      if (direccion) destinoDe.set(p.id, direccion);
    }

    // Sin correo no hay a dónde mandar. Se corta aquí y no se guarda una
    // solicitud FALLIDA: es un dato que FALTA, no un envío que salió mal.
    const sinCorreo = proveedores.find((p) => !destinoDe.has(p.id));
    if (sinCorreo)
      throw new BadRequestException(
        `"${sinCorreo.razonSocial}" no tiene correo. ` +
          'Escríbelo en el selector o complétalo en su ficha.',
      );

    /**
     * Un correo escrito para un proveedor que NO tenía ninguno se guarda
     * en su ficha: es un dato que faltaba y que acaba de aparecer, y no
     * guardarlo obligaría a reescribirlo en cada envío.
     *
     * Al que YA tenía uno no se le toca la ficha. Ahí la dirección escrita
     * es un desvío para ESTE envío —que queda congelado en `destinatario`,
     * como siempre—, y pisar el maestro desde una pantalla de envío sería
     * editar el catálogo por la puerta de atrás.
     */
    const aCompletar = proveedores.filter(
      (p) => !p.correo && correoEscrito.get(p.id),
    );
    for (const p of aCompletar) {
      const nuevo = destinoDe.get(p.id) as string;
      await this.prisma.proveedor.update({
        where: { id: p.id },
        data: { correo: nuevo },
      });
      await this.auditoria.registrarUno(usuario, {
        requerimientoId,
        entidad: 'PROVEEDOR',
        entidadId: p.id,
        accion: 'EDICION',
        campoAfectado: 'correo',
        valorAnterior: null,
        valorNuevo: nuevo,
        descripcion: `Se completó el correo de ${p.razonSocial} al pedirle cotización.`,
      });
    }

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

      const para = destinoDe.get(p.id) as string;

      const resultado = await this.correo.enviarSolicitudCotizacion({
        para,
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
            destinatario: para,
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
            descripcion: `Se pidió cotización a ${p.razonSocial} (${para}).`,
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
