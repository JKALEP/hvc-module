import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aId } from '../../common/validacion';
import { limpiar, describir } from '../../common/texto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { RequerimientoService } from '../requerimiento/requerimiento.service';
import type { CostoItemDto, RegistrarCostoDto } from './dto';

/**
 * El registro del costo (§47-52).
 *
 * Lo hace el SOLICITANTE, no el Gestor: §46 dice que tras la aprobación
 * la tarea vuelve a quien pidió. Es el cierre económico del proceso y
 * deja el requerimiento FINALIZADO.
 *
 * Las cinco primeras columnas de §49 se COPIAN del ítem del
 * requerimiento en el servidor. No se aceptan del cliente aunque la
 * pantalla las muestre: son un snapshot (§53 prohíbe perder un valor
 * histórico, §54 avisa de que el ítem puede cambiar después), y un
 * snapshot que viaja por la red es un snapshot que alguien puede
 * alterar.
 *
 * `costoUnitario` es POR UNIDAD. El total de la línea es
 * cantidad × costoUnitario y se calcula en lectura, igual que en toda la
 * casa.
 */
@Injectable()
export class RegistroCostoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly requerimientos: RequerimientoService,
  ) {}

  /**
   * §50: monetario, no negativo y con precisión de precio unitario.
   *
   * Cero se admite a propósito: un ítem que el proveedor entrega sin
   * cargo —una muestra, algo incluido en otra partida— cuesta 0, y
   * obligar a inventar un céntimo sería peor dato que la verdad.
   */
  private aCosto(valor: unknown, descripcion: string): string {
    // Mismo camino que `LineasService.aDecimal`: `limpiar` acota el
    // `unknown` a texto o nada, en vez de dejar que un objeto se cuele
    // como "[object Object]" y acabe siendo NaN sin que se sepa por qué.
    const n =
      typeof valor === 'number'
        ? valor
        : Number(limpiar(valor)?.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0)
      throw new BadRequestException(
        `El costo de "${descripcion}" debe ser un número mayor o igual a 0. ` +
          `Recibido: "${describir(valor)}".`,
      );
    return n.toFixed(4);
  }

  /** La cotización aprobada del requerimiento, con su proveedor y sus líneas. */
  private async cotizacionAprobada(requerimientoId: number) {
    const cotizacion = await this.prisma.cotizacionProveedor.findFirst({
      where: { requerimientoId, estado: 'APROBADA' },
      include: { proveedor: true, items: true },
    });
    if (!cotizacion)
      throw new BadRequestException(
        'Este requerimiento no tiene ninguna cotización aprobada.',
      );

    // §54: la aprobada dejó de cotizar lo que se pide. No debería
    // llegarse aquí —editar un ítem de la aprobada devuelve el
    // requerimiento a COTIZACIONES_RECIBIDAS y la transición ya lo
    // cortaría—, pero el costo es el asiento definitivo y no se apoya en
    // que otra comprobación haya funcionado.
    if (cotizacion.requiereRevision)
      throw new BadRequestException(
        `La cotización aprobada quedó pendiente de revisar: ${cotizacion.revisionMotivo ?? 'cambió lo que se pide.'} ` +
          'Hay que volver a cotizar y aprobar antes de registrar el costo.',
      );

    return cotizacion;
  }

  /**
   * La plantilla de costos de §48-49, ya rellena.
   *
   * Devuelve los datos del proveedor —de la ficha, no tecleados— y los
   * ítems con sus cinco columnas. Lo único que queda por llenar es el
   * costo de cada uno.
   *
   * Existe como endpoint propio porque «cuál es la cotización aprobada»
   * es una regla del backend, y hacer que la pantalla la deduzca sería
   * repartir la misma decisión en dos sitios.
   */
  async plantilla(usuario: UsuarioAutenticado, requerimientoId: number) {
    const req = await this.requerimientos.detalle(usuario, requerimientoId);
    const cotizacion = await this.cotizacionAprobada(requerimientoId);

    // Lo que el proveedor cotizó para cada ítem, como referencia de lo
    // que debería costar. NO se precarga como costo: §50 dice que el
    // Solicitante lo registra, y rellenarlo por él convertiría un
    // registro en una confirmación automática.
    const cotizado = new Map<number, string>();
    for (const l of cotizacion.items)
      if (l.requerimientoItemId !== null)
        cotizado.set(l.requerimientoItemId, l.precioUnitario.toString());

    return {
      requerimiento: {
        id: req.id,
        numero: req.numero,
        cliente: req.clienteNombre,
        lugarEntrega: req.lugarEntrega,
      },
      // §48: se muestran y se autocompletan desde la entidad Proveedor.
      proveedor: {
        id: cotizacion.proveedor.id,
        razonSocial: cotizacion.proveedor.razonSocial,
        ruc: cotizacion.proveedor.ruc,
        telefono: cotizacion.proveedor.telefono,
      },
      cotizacionId: cotizacion.id,
      items: req.items.map((i) => ({
        requerimientoItemId: i.id,
        orden: i.orden,
        descripcion: i.descripcion,
        unidad: i.unidad,
        cantidad: i.cantidad,
        detalleObservacion: i.detalleObservacion,
        referencias: i.referencias,
        /**
         * Lo que cotizó el proveedor, si cotizó este ítem. Solo
         * referencia: número, como todo lo que sale ya calculado hacia
         * la pantalla.
         */
        precioCotizado: cotizado.has(i.id) ? Number(cotizado.get(i.id)) : null,
      })),
    };
  }

  /** El costo ya registrado, con el total de cada línea calculado. */
  async detalle(usuario: UsuarioAutenticado, requerimientoId: number) {
    await this.requerimientos.detalle(usuario, requerimientoId);

    const costo = await this.prisma.costo.findUnique({
      where: { requerimientoId },
      include: {
        items: { orderBy: { orden: 'asc' } },
        registradoPor: { select: { id: true, nombre: true } },
      },
    });
    if (!costo)
      throw new NotFoundException(
        'Todavía no se registró el costo de este requerimiento.',
      );

    const items = costo.items.map((i) => {
      const costoUnitario = Number(i.costoUnitario.toString());
      return {
        ...i,
        costoUnitario,
        // Dinero: 2 decimales, no los 4 del unitario.
        costoTotal: Math.round(costoUnitario * i.cantidad * 100) / 100,
      };
    });

    return {
      ...costo,
      items,
      total:
        Math.round(items.reduce((a, i) => a + i.costoTotal, 0) * 100) / 100,
    };
  }

  /**
   * Valida los costos que llegan contra los ítems del requerimiento.
   *
   * Exige uno por CADA ítem: §49 muestra la plantilla entera y §52 la
   * Base de Costos se alimenta de aquí. Dejar un ítem sin costo daría un
   * histórico con huecos que nadie sabría interpretar —¿salió gratis, o
   * se olvidaron?—. Si algo no se compró, se registra en 0.
   */
  private async normalizar(requerimientoId: number, valor: unknown) {
    if (!Array.isArray(valor) || valor.length === 0)
      throw new BadRequestException('Registra el costo de cada ítem.');

    const items = await this.prisma.requerimientoItem.findMany({
      where: { requerimientoId },
      orderBy: { orden: 'asc' },
    });

    const porId = new Map(items.map((i) => [i.id, i]));
    const vistos = new Set<number>();
    const filas: {
      requerimientoItemId: number;
      orden: number;
      descripcion: string;
      unidad: string;
      cantidad: number;
      detalleObservacion: string | null;
      referencias: string | null;
      costoUnitario: string;
    }[] = [];

    for (const [n, cruda] of (valor as CostoItemDto[]).entries()) {
      const itemId = aId(
        cruda?.requerimientoItemId,
        `La línea ${n + 1} no indica a qué ítem corresponde.`,
      );
      const item = porId.get(itemId);
      if (!item)
        throw new BadRequestException(
          `El ítem ${itemId} no es de este requerimiento.`,
        );
      if (vistos.has(itemId))
        throw new BadRequestException(
          `El ítem "${item.descripcion}" viene dos veces.`,
        );
      vistos.add(itemId);

      filas.push({
        requerimientoItemId: item.id,
        orden: item.orden,
        // Snapshot: se copia del ítem, no de lo que mandó el cliente.
        descripcion: item.descripcion,
        unidad: item.unidad,
        cantidad: item.cantidad,
        detalleObservacion: item.detalleObservacion,
        referencias: item.referencias,
        costoUnitario: this.aCosto(cruda?.costoUnitario, item.descripcion),
      });
    }

    const faltan = items.filter((i) => !vistos.has(i.id));
    if (faltan.length > 0)
      throw new BadRequestException(
        `Falta el costo de ${faltan.length} ítem(s): ` +
          `${faltan.map((i) => `"${i.descripcion}"`).join(', ')}. ` +
          'Si alguno no se compró, regístralo en 0.',
      );

    return filas.sort((a, b) => a.orden - b.orden);
  }

  /**
   * Registra el costo y cierra el requerimiento (§51).
   *
   * Todo en una transacción con la transición a FINALIZADO: un costo a
   * medias con el requerimiento cerrado sería una fila que la Base de
   * Costos leería como verdad.
   */
  async registrar(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    dto: RegistrarCostoDto,
  ) {
    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      select: { id: true, estado: true, numero: true },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    const existe = await this.prisma.costo.findUnique({
      where: { requerimientoId },
      select: { id: true },
    });
    if (existe)
      throw new BadRequestException(
        'Este requerimiento ya tiene su costo registrado. ' +
          'Para corregirlo, edítalo.',
      );

    const cotizacion = await this.cotizacionAprobada(requerimientoId);
    const items = await this.normalizar(requerimientoId, dto.items);

    await this.prisma.$transaction(async (tx) => {
      const costo = await tx.costo.create({
        data: {
          requerimientoId,
          proveedorId: cotizacion.proveedorId,
          cotizacionId: cotizacion.id,
          // §48 congelado: dentro de un año el teléfono será otro y esto
          // tiene que seguir diciendo a quién se le compró.
          proveedorRazonSocial: cotizacion.proveedor.razonSocial,
          proveedorRuc: cotizacion.proveedor.ruc,
          proveedorTelefono: cotizacion.proveedor.telefono,
          registradoPorId: usuario.id,
          items: { create: items },
        },
        select: { id: true },
      });

      await this.auditoria.registrarUno(
        usuario,
        {
          requerimientoId,
          entidad: 'COSTO',
          entidadId: costo.id,
          accion: 'REGISTRO_COSTO',
          descripcion:
            `Se registró el costo de ${items.length} ítem(s) con ` +
            `${cotizacion.proveedor.razonSocial}.`,
        },
        tx,
      );

      await this.requerimientos.aplicarTransicion(
        usuario,
        tx,
        req,
        'REGISTRAR_COSTO',
      );
    });

    return this.detalle(usuario, requerimientoId);
  }

  /**
   * Corrige un costo ya registrado.
   *
   * §51 habla de «crear/actualizar costo», así que corregir una errata
   * está previsto. Lo que NO se toca es el estado —el requerimiento sigue
   * FINALIZADO— ni el proveedor ni la cotización de origen: eso no es una
   * errata, es otro costo.
   *
   * Cada cambio de importe queda en la bitácora con su valor anterior,
   * que es lo que §53 exige para no perder nada en silencio.
   */
  async editar(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    dto: RegistrarCostoDto,
  ) {
    const actual = await this.prisma.costo.findUnique({
      where: { requerimientoId },
      include: { items: true },
    });
    if (!actual)
      throw new NotFoundException(
        'Todavía no se registró el costo de este requerimiento.',
      );

    // Solo quien lo registró, o alguien por encima del rol. El control
    // de alcance del requerimiento ya corrió en `detalle`.
    await this.requerimientos.detalle(usuario, requerimientoId);

    const items = await this.normalizar(requerimientoId, dto.items);

    /**
     * Los importes anteriores, YA NORMALIZADOS a 4 decimales.
     *
     * `Decimal.toString()` de Prisma devuelve la forma corta —`11`, no
     * `11.0000`— mientras que lo que llega del formulario pasa por
     * `toFixed(4)`. Compararlos como texto marcaría como «editado» un
     * importe que no cambió, y llenaría la bitácora de ruido que después
     * nadie sabe distinguir de un cambio real.
     */
    const antes = new Map(
      actual.items.map((i) => [
        i.requerimientoItemId,
        Number(i.costoUnitario.toString()).toFixed(4),
      ]),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.costoItem.deleteMany({ where: { costoId: actual.id } });
      await tx.costoItem.createMany({
        data: items.map((i) => ({ ...i, costoId: actual.id })),
      });

      const eventos = items
        .filter((i) => antes.get(i.requerimientoItemId) !== i.costoUnitario)
        .map((i) => ({
          requerimientoId,
          entidad: 'COSTO' as const,
          entidadId: actual.id,
          accion: 'EDICION' as const,
          campoAfectado: `costo:${i.descripcion}`,
          valorAnterior: antes.get(i.requerimientoItemId) ?? null,
          valorNuevo: i.costoUnitario,
        }));

      await this.auditoria.registrar(usuario, eventos, tx);
    });

    return this.detalle(usuario, requerimientoId);
  }
}
