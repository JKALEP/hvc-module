import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { LineasService } from '../../common/lineas.service';
import { RequerimientoService } from '../requerimiento/requerimiento.service';

/**
 * La comparación entre proveedores (§37) — solo lectura.
 *
 * Service aparte del CRUD, igual que `base-costos` o
 * `proyecto-analitica`: responde otra pregunta. El CRUD registra lo que
 * respondió UN proveedor; esto responde «¿cuál conviene?», que solo
 * existe mirando a todos a la vez.
 *
 * Devuelve dos vistas de lo mismo, porque son dos decisiones distintas:
 *
 *   · `proveedores` — una fila por cotización con lo que §37 pide de un
 *     vistazo: total, garantía, plazo, condiciones, observaciones. Sirve
 *     para elegir con quién trabajar.
 *
 *   · `items` — una fila por ítem PEDIDO y, dentro, lo que cada proveedor
 *     cotizó para él. Sirve para ver que el más barato en total puede no
 *     serlo en la línea que importa, y para detectar quién no cotizó algo.
 *
 * Las descartadas se devuelven marcadas y NO cuentan para el mejor
 * precio: §40 dice que el Aprobador ve todas las cotizaciones, así que
 * esconderlas sería quitarle información, pero dejarlas compitiendo sería
 * ignorar que el Gestor ya las sacó.
 */
@Injectable()
export class ComparacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineas: LineasService,
    private readonly requerimientos: RequerimientoService,
  ) {}

  async comparar(usuario: UsuarioAutenticado, requerimientoId: number) {
    await this.requerimientos.detalle(usuario, requerimientoId);

    const [items, cotizaciones] = await Promise.all([
      this.prisma.requerimientoItem.findMany({
        where: { requerimientoId },
        orderBy: { orden: 'asc' },
      }),
      this.prisma.cotizacionProveedor.findMany({
        where: { requerimientoId },
        orderBy: [{ creadoEn: 'asc' }],
        include: {
          items: { orderBy: { orden: 'asc' } },
          proveedor: {
            select: { id: true, razonSocial: true, ruc: true, correo: true },
          },
        },
      }),
    ]);

    // ── Una fila por cotización, con su total calculado ──
    const proveedores = cotizaciones.map((c) => {
      const lineas = this.lineas.calcularLineas(c.items);
      return {
        cotizacionId: c.id,
        proveedorId: c.proveedor.id,
        proveedor: c.proveedor.razonSocial,
        ruc: c.proveedor.ruc,
        estado: c.estado,
        // §54: sigue siendo lo que el proveedor respondió, pero un ítem
        // cambió después. Va aquí porque es en la comparación donde el
        // Gestor decide, y comparar contra un precio caducado es peor que
        // no tener precio.
        requiereRevision: c.requiereRevision,
        revisionMotivo: c.revisionMotivo,
        fechaCotizacion: c.fechaCotizacion,
        validaHasta: c.validaHasta,
        garantia: c.garantia,
        plazoEntrega: c.plazoEntrega,
        condicionesPago: c.condicionesPago,
        observaciones: c.observaciones,
        lineas: lineas.length,
        total: this.lineas.total(lineas),
        /** Cuántos de los ítems pedidos cubre. Cotizar 3 de 8 no es competir. */
        itemsCubiertos: new Set(
          c.items
            .map((i) => i.requerimientoItemId)
            .filter((id): id is number => id !== null),
        ).size,
      };
    });

    // Ni las descartadas ni las que quedaron pendientes de revisar
    // compiten por el mejor total: unas están fuera por decisión del
    // Gestor y las otras ponen precio a algo que ya no se pide.
    const enJuego = proveedores.filter(
      (p) => p.estado !== 'DESCARTADA' && !p.requiereRevision,
    );
    const totalMasBajo = enJuego.length
      ? Math.min(...enJuego.map((p) => p.total))
      : null;

    /**
     * A qué ítem pedido responde cada línea, por ID de línea.
     *
     * Se indexa por id y NO por posición: `calcularLineas` ORDENA lo que
     * recibe, así que el índice del resultado no tiene por qué coincidir
     * con el del array original. Hoy coincide de casualidad —la consulta
     * ya trae las líneas por `orden`—, y de esa casualidad depende que
     * cada precio se atribuya al ítem correcto. Con el id no depende de
     * nada.
     */
    const itemDeLinea = new Map<number, number | null>();
    for (const c of cotizaciones)
      for (const l of c.items) itemDeLinea.set(l.id, l.requerimientoItemId);

    // Cada cotización con sus líneas ya calculadas, una sola vez: dentro
    // del bucle por ítem se recalculaba N veces lo mismo.
    const calculadas = cotizaciones.map((c) => ({
      cotizacion: c,
      lineas: this.lineas.calcularLineas(c.items),
    }));

    // ── Una fila por ítem pedido, con lo que ofreció cada proveedor ──
    const porItem = items.map((item) => {
      const ofertas = calculadas.flatMap(({ cotizacion: c, lineas }) =>
        lineas
          .filter((l) => itemDeLinea.get(l.id) === item.id)
          .map((l) => ({
            cotizacionId: c.id,
            proveedor: c.proveedor.razonSocial,
            estado: c.estado,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            subtotal: l.subtotal,
          })),
      );

      const compiten = ofertas.filter((o) => o.estado !== 'DESCARTADA');

      return {
        requerimientoItemId: item.id,
        orden: item.orden,
        descripcion: item.descripcion,
        unidad: item.unidad,
        cantidad: item.cantidad,
        detalleObservacion: item.detalleObservacion,
        referencias: item.referencias,
        ofertas,
        /**
         * El precio unitario más bajo entre las que compiten, o null si
         * nadie cotizó este ítem. Null NO es cero: «nadie lo ofreció» y
         * «lo ofrecieron gratis» son cosas distintas.
         */
        mejorPrecioUnitario: compiten.length
          ? Math.min(...compiten.map((o) => o.precioUnitario))
          : null,
      };
    });

    // ── Las líneas que ningún ítem pedido reclama (§36: flete, etc.) ──
    const extras = calculadas.flatMap(({ cotizacion: c, lineas }) =>
      lineas
        .filter((l) => itemDeLinea.get(l.id) === null)
        .map((l) => ({
          cotizacionId: c.id,
          proveedor: c.proveedor.razonSocial,
          estado: c.estado,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          subtotal: l.subtotal,
        })),
    );

    return {
      totalItemsPedidos: items.length,
      totalMasBajo,
      proveedores,
      items: porItem,
      extras,
    };
  }
}
