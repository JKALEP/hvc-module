import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { LineasService } from '../../common/lineas.service';
import { aId, aIdOpcional } from '../../common/validacion';
import { aFechaUTC } from '../../common/fechas';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { RequerimientoService } from '../requerimiento/requerimiento.service';
import { aTexto, aTextoOpcional } from '../validacion';
import type {
  GuardarCotizacionDto,
  EditarCotizacionDto,
  ItemCotizacionDto,
} from './dto';

/**
 * Las cotizaciones que responden los proveedores (§34-37).
 *
 * §36 es tajante: los proveedores mandan formatos distintos y HOY no se
 * interpretan automáticamente. El Gestor teclea lo que hace falta para
 * comparar, y eso —no el PDF que llegó— es la fuente. Por eso no hay
 * columna de adjunto.
 *
 * Tampoco hay columna de total: es la suma de las líneas y se calcula en
 * lectura con `LineasService`, el mismo que usan las cotizaciones y
 * órdenes de compra del módulo de Equipos. Guardarlo obligaría a
 * reescribirlo en cada alta, edición y borrado de línea, y el día que uno
 * de esos caminos fallara el total mentiría.
 */
@Injectable()
export class CotizacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineas: LineasService,
    private readonly auditoria: AuditoriaService,
    private readonly requerimientos: RequerimientoService,
  ) {}

  private get incluir() {
    return {
      items: { orderBy: { orden: 'asc' as const } },
      proveedor: {
        select: {
          id: true,
          razonSocial: true,
          nombreComercial: true,
          ruc: true,
          correo: true,
          telefono: true,
        },
      },
      registradaPor: { select: { id: true, nombre: true } },
    };
  }

  /**
   * Añade lo que se calcula: subtotales por línea y total del documento.
   *
   * `calcularLineas` es de `common/` y solo conoce la aritmética que
   * comparten Costos y Equipos —descripción, cantidad, precio,
   * subtotal—, así que devuelve una línea PELADA. Lo propio de una
   * cotización de Costos, `unidad` y a qué ítem del requerimiento
   * responde, se vuelve a pegar aquí **por id**, no por posición:
   * `calcularLineas` ordena lo que recibe y el índice del resultado no
   * tiene por qué ser el del array original — el mismo motivo por el
   * que `ComparacionService` indexa por id.
   *
   * Sin esto la lectura no cierra el ciclo: el formulario de edición no
   * podría saber qué línea contestaba a qué ítem, y volver a guardar la
   * cotización con las líneas tal como se leyeron las dejaría a todas
   * sueltas (§36), rompiendo la comparación por ítem de §37.
   */
  private conTotales<
    T extends {
      items: {
        id: number;
        orden: number;
        descripcion: string;
        unidad: string | null;
        requerimientoItemId: number | null;
        cantidad: { toString(): string };
        precioUnitario: { toString(): string };
      }[];
    },
  >(fila: T) {
    const propias = new Map(fila.items.map((i) => [i.id, i]));
    const items = this.lineas.calcularLineas(fila.items).map((l) => ({
      ...l,
      unidad: propias.get(l.id)?.unidad ?? null,
      requerimientoItemId: propias.get(l.id)?.requerimientoItemId ?? null,
    }));
    return { ...fila, items, total: this.lineas.total(items) };
  }

  async listar(usuario: UsuarioAutenticado, requerimientoId: number) {
    await this.requerimientos.detalle(usuario, requerimientoId);

    const filas = await this.prisma.cotizacionProveedor.findMany({
      where: { requerimientoId },
      orderBy: [{ creadoEn: 'asc' }],
      include: this.incluir,
    });
    return filas.map((f) => this.conTotales(f));
  }

  async detalle(usuario: UsuarioAutenticado, id: number) {
    const fila = await this.prisma.cotizacionProveedor.findUnique({
      where: { id },
      include: this.incluir,
    });
    if (!fila) throw new NotFoundException('Esa cotización ya no existe.');

    // Mismo control de acceso que el requerimiento del que cuelga.
    await this.requerimientos.detalle(usuario, fila.requerimientoId);
    return this.conTotales(fila);
  }

  /**
   * Valida las líneas de la cotización.
   *
   * La descripción, la cantidad y el precio los valida `LineasService`,
   * que es quien fija cómo se convierte un decimal en todo el sistema.
   * Lo propio de aquí —la unidad y a qué ítem del requerimiento responde
   * cada línea— se añade encima, por índice.
   *
   * `requerimientoItemId` es opcional a propósito (§36): lo normal es que
   * cada línea conteste a un ítem pedido —y así la comparación es línea a
   * línea—, pero el proveedor puede añadir flete o instalación.
   */
  private async normalizarItems(requerimientoId: number, valor: unknown) {
    const base = this.lineas.normalizarLineas(valor);
    if (base.length === 0)
      throw new BadRequestException(
        'La cotización necesita al menos una línea.',
      );

    const crudas = valor as ItemCotizacionDto[];

    const items = base.map((b, i) => ({
      ...b,
      unidad: aTextoOpcional(crudas[i]?.unidad),
      requerimientoItemId: aIdOpcional(
        crudas[i]?.requerimientoItemId,
        `La línea ${i + 1} apunta a un ítem que no es válido.`,
      ),
    }));

    // Los ítems referenciados tienen que ser DE ESTE requerimiento. Sin
    // esta comprobación, una cotización podría colgar sus líneas de los
    // ítems de otro y la comparación mezclaría dos pedidos.
    const referencias = items
      .map((i) => i.requerimientoItemId)
      .filter((id): id is number => id !== null);

    if (referencias.length > 0) {
      const validos = await this.prisma.requerimientoItem.count({
        where: { id: { in: referencias }, requerimientoId },
      });
      if (validos !== new Set(referencias).size)
        throw new BadRequestException(
          'Alguna línea apunta a un ítem que no es de este requerimiento.',
        );
    }

    return items;
  }

  /** Los campos de cabecera de §37, validados. */
  private cabecera(dto: GuardarCotizacionDto, parcial: boolean) {
    const exige = (c: keyof GuardarCotizacionDto) => !parcial || c in dto;
    const data: {
      fechaCotizacion?: Date;
      validaHasta?: Date | null;
      garantia?: string | null;
      plazoEntrega?: string | null;
      condicionesPago?: string | null;
      observaciones?: string | null;
    } = {};

    if (exige('fechaCotizacion'))
      data.fechaCotizacion = aFechaUTC(
        aTexto(dto.fechaCotizacion, 'La fecha de la cotización'),
        'fechaCotizacion',
      );

    if ('validaHasta' in dto)
      data.validaHasta = dto.validaHasta
        ? aFechaUTC(dto.validaHasta, 'validaHasta')
        : null;

    if ('garantia' in dto) data.garantia = aTextoOpcional(dto.garantia);
    if ('plazoEntrega' in dto)
      data.plazoEntrega = aTextoOpcional(dto.plazoEntrega);
    if ('condicionesPago' in dto)
      data.condicionesPago = aTextoOpcional(dto.condicionesPago);
    if ('observaciones' in dto)
      data.observaciones = aTextoOpcional(dto.observaciones);

    return data;
  }

  /**
   * Registra una cotización recibida (§34).
   *
   * No exige que venga de una `SolicitudCotizacion`: §35 admite que un
   * proveedor cotice sin que se le haya pedido formalmente. Si viene de
   * una, se enlaza para que quede la trazabilidad del ida y vuelta.
   */
  async crear(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    dto: GuardarCotizacionDto,
  ) {
    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      select: { id: true, estado: true },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    const proveedorId = aId(dto.proveedorId, 'El proveedor no es válido.');
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id: proveedorId },
      select: { id: true, razonSocial: true, estado: true },
    });
    if (!proveedor)
      throw new BadRequestException(`El proveedor ${proveedorId} no existe.`);
    if (proveedor.estado !== 'ACTIVO')
      throw new BadRequestException(
        `"${proveedor.razonSocial}" está desactivado.`,
      );

    const solicitudId = aIdOpcional(
      dto.solicitudId,
      'La solicitud no es válida.',
    );
    if (solicitudId !== null) {
      const solicitud = await this.prisma.solicitudCotizacion.findFirst({
        where: { id: solicitudId, requerimientoId, proveedorId },
        select: { id: true },
      });
      if (!solicitud)
        throw new BadRequestException(
          'Esa solicitud no es de este requerimiento y este proveedor.',
        );
    }

    const cabecera = this.cabecera(dto, false);
    const items = await this.normalizarItems(requerimientoId, dto.items);

    const creada = await this.prisma.$transaction(async (tx) => {
      const cotizacion = await tx.cotizacionProveedor.create({
        data: {
          requerimientoId,
          proveedorId,
          solicitudId,
          fechaCotizacion: cabecera.fechaCotizacion as Date,
          validaHasta: cabecera.validaHasta ?? null,
          garantia: cabecera.garantia ?? null,
          plazoEntrega: cabecera.plazoEntrega ?? null,
          condicionesPago: cabecera.condicionesPago ?? null,
          observaciones: cabecera.observaciones ?? null,
          registradaPorId: usuario.id,
          items: { create: items },
        },
        select: { id: true },
      });

      await this.auditoria.registrarUno(
        usuario,
        {
          requerimientoId,
          entidad: 'COTIZACION',
          entidadId: cotizacion.id,
          accion: 'CREACION',
          descripcion: `Se registró la cotización de ${proveedor.razonSocial} con ${items.length} línea(s).`,
        },
        tx,
      );

      await this.requerimientos.aplicarTransicion(
        usuario,
        tx,
        req,
        'REGISTRAR_COTIZACION',
      );

      return cotizacion;
    });

    return this.detalle(usuario, creada.id);
  }

  /**
   * Corrige una cotización mal tecleada.
   *
   * Las líneas se reemplazan ENTERAS cuando llegan: la lista que manda el
   * formulario ES la de la cotización, así que quitar un renglón en
   * pantalla tiene que quitarlo de verdad y no dejarlo huérfano. Mismo
   * criterio que los documentos de Equipos.
   *
   * No se toca una cotización ya aprobada: a partir de ahí es el
   * respaldo de un costo registrado, y §53 no admite reescribirlo.
   */
  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: EditarCotizacionDto,
  ) {
    const actual = await this.prisma.cotizacionProveedor.findUnique({
      where: { id },
      include: { proveedor: { select: { razonSocial: true } } },
    });
    if (!actual) throw new NotFoundException('Esa cotización ya no existe.');

    if (actual.estado === 'APROBADA')
      throw new BadRequestException(
        'Esa cotización ya fue aprobada: no se puede modificar.',
      );

    const cabecera = this.cabecera(dto, true);
    const items =
      dto.items === undefined
        ? null
        : await this.normalizarItems(actual.requerimientoId, dto.items);

    await this.prisma.$transaction(async (tx) => {
      // Actualizar la cotización ES volver a registrar lo que el
      // proveedor respondió, así que apaga la marca de §54: ya cotiza lo
      // que se está pidiendo. Se apaga siempre, no solo si venían
      // líneas — el Gestor puede haber tenido que corregir solo el plazo.
      if (Object.keys(cabecera).length > 0 || items !== null)
        await tx.cotizacionProveedor.update({
          where: { id },
          data: { ...cabecera, requiereRevision: false, revisionMotivo: null },
        });

      if (items !== null) {
        await tx.cotizacionProveedorItem.deleteMany({
          where: { cotizacionId: id },
        });
        await tx.cotizacionProveedorItem.createMany({
          data: items.map((i) => ({ ...i, cotizacionId: id })),
        });
      }

      const dia = (f: Date | null) => (f ? f.toISOString().slice(0, 10) : null);

      await this.auditoria.registrar(
        usuario,
        [
          ...this.auditoria.diferencias(
            {
              fechaCotizacion: dia(actual.fechaCotizacion),
              validaHasta: dia(actual.validaHasta),
              garantia: actual.garantia,
              plazoEntrega: actual.plazoEntrega,
              condicionesPago: actual.condicionesPago,
              observaciones: actual.observaciones,
            },
            {
              fechaCotizacion: dia(
                cabecera.fechaCotizacion ?? actual.fechaCotizacion,
              ),
              validaHasta: dia(
                cabecera.validaHasta === undefined
                  ? actual.validaHasta
                  : cabecera.validaHasta,
              ),
              garantia: cabecera.garantia ?? actual.garantia,
              plazoEntrega: cabecera.plazoEntrega ?? actual.plazoEntrega,
              condicionesPago:
                cabecera.condicionesPago ?? actual.condicionesPago,
              observaciones: cabecera.observaciones ?? actual.observaciones,
            },
            {
              requerimientoId: actual.requerimientoId,
              entidad: 'COTIZACION',
              entidadId: id,
            },
          ),
          ...(items !== null
            ? [
                {
                  requerimientoId: actual.requerimientoId,
                  entidad: 'COTIZACION' as const,
                  entidadId: id,
                  accion: 'EDICION' as const,
                  campoAfectado: 'items',
                  descripcion: `Se reemplazaron las líneas: ahora son ${items.length}.`,
                },
              ]
            : []),
        ],
        tx,
      );
    });

    return this.detalle(usuario, id);
  }

  /**
   * Descarta una cotización de la comparación (§37) sin borrarla.
   *
   * Es lo que el Gestor hace con la que llegó fuera de plazo o con la que
   * no cumple: deja de contar, pero el Aprobador sigue viendo que existió
   * y por qué se dejó fuera. Borrarla sería perder que ese proveedor
   * respondió.
   */
  async descartar(usuario: UsuarioAutenticado, id: number, motivo?: string) {
    const actual = await this.prisma.cotizacionProveedor.findUnique({
      where: { id },
      include: { proveedor: { select: { razonSocial: true } } },
    });
    if (!actual) throw new NotFoundException('Esa cotización ya no existe.');

    if (actual.estado === 'APROBADA')
      throw new BadRequestException(
        'Esa cotización está aprobada: no se puede descartar.',
      );
    if (actual.estado === 'RECOMENDADA')
      throw new BadRequestException(
        'Esa cotización es la recomendada. Recomienda otra antes de descartarla.',
      );

    const razon = aTexto(motivo, 'El motivo para descartarla');

    await this.prisma.cotizacionProveedor.update({
      where: { id },
      data: { estado: 'DESCARTADA' },
    });

    await this.auditoria.registrarUno(usuario, {
      requerimientoId: actual.requerimientoId,
      entidad: 'COTIZACION',
      entidadId: id,
      accion: 'CAMBIO_ESTADO',
      campoAfectado: 'estado',
      valorAnterior: actual.estado,
      valorNuevo: 'DESCARTADA',
      motivo: razon,
      descripcion: `Se descartó la cotización de ${actual.proveedor.razonSocial}.`,
    });

    return this.detalle(usuario, id);
  }
}
