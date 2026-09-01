import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type {
  Exportable,
  BloqueExportable,
} from '../../common/exportacion.service';
import { ETIQUETA_ESTADO } from '../requerimiento/estados';
import { RequerimientoService } from '../requerimiento/requerimiento.service';
import { ComparacionService } from '../cotizacion/comparacion.service';
import { RegistroCostoService } from '../costo/registro-costo.service';

/** Un día como lo lee una persona. */
function dia(f: Date | string | null): string {
  if (!f) return '—';
  const d = typeof f === 'string' ? new Date(f) : f;
  return d.toISOString().slice(0, 10).split('-').reverse().join('/');
}

const guion = (v: string | null | undefined) => v ?? '—';

/**
 * El estado de una cotización, en castellano.
 *
 * El papel lo lee una persona, no un programa: `RECOMENDADA` en una
 * columna estrecha se parte en «RECOMEN / DADA», que además de feo se
 * lee peor que la palabra normal.
 */
const ESTADO_COTIZACION: Record<string, string> = {
  REGISTRADA: 'Registrada',
  RECOMENDADA: 'Recomendada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  DESCARTADA: 'Descartada',
};

/**
 * Los tres documentos exportables del módulo (§69).
 *
 * Service de solo lectura y separado del CRUD, igual que
 * `base-costos` o `comparacion`: responde otra pregunta —«dame esto en
 * un archivo»— y no toca nada.
 *
 * Su único trabajo es TRADUCIR lo que ya saben otros services a la
 * forma `Exportable` que entiende `common/exportacion.service.ts`. No
 * consulta por su cuenta lo que otro ya sabe responder: la comparación
 * la arma `ComparacionService` y el costo `RegistroCostoService`, así
 * que el Excel y el PDF dicen exactamente lo mismo que la pantalla. Si
 * calculara sus propios totales, el día que cambiara una regla habría
 * dos verdades y la de papel sería la que se manda al proveedor.
 *
 * §6 y §5 siguen en pie al revés: el archivo se genera DESDE los datos,
 * nunca se interpreta un archivo para obtener datos.
 */
@Injectable()
export class ExportableService {
  constructor(
    private readonly requerimientos: RequerimientoService,
    private readonly comparacion: ComparacionService,
    private readonly costos: RegistroCostoService,
  ) {}

  /**
   * El requerimiento con sus ítems (§19, §69).
   *
   * Es el documento que el Solicitante enseña y que el Gestor manda a
   * los proveedores: las cinco columnas de §19 y nada más. Sin precios,
   * porque en este punto del proceso no los hay.
   */
  async requerimiento(
    usuario: UsuarioAutenticado,
    id: number,
  ): Promise<Exportable> {
    // Reutiliza el control de acceso del detalle: un Solicitante no
    // exporta un requerimiento ajeno.
    const req = await this.requerimientos.detalle(usuario, id);

    return {
      titulo: `Requerimiento ${req.numero ?? '(borrador)'}`,
      nombreArchivo: `requerimiento-${req.numero ?? `borrador-${String(req.id)}`}`,
      datos: [
        {
          etiqueta: 'N.º de pedido',
          valor: req.numero ?? '(se asigna al emitir)',
        },
        { etiqueta: 'Estado', valor: ETIQUETA_ESTADO[req.estado] },
        { etiqueta: 'Cliente', valor: req.clienteNombre },
        { etiqueta: 'Supervisor', valor: req.supervisorNombre },
        {
          etiqueta: 'Tipo de mantenimiento',
          valor: req.tipoMantenimientoNombre,
        },
        {
          etiqueta: 'Tipo de requerimiento',
          valor: req.tipoRequerimientoNombre,
        },
        { etiqueta: 'Lugar de entrega', valor: req.lugarEntrega },
        { etiqueta: 'Fecha de entrega', valor: dia(req.fechaEntrega) },
        { etiqueta: 'Fecha de emisión', valor: dia(req.fechaEmision) },
        { etiqueta: 'Solicitante', valor: guion(req.solicitante?.nombre) },
      ],
      bloques: [
        {
          titulo: 'Ítems solicitados',
          columnas: [
            // El ancho total en PDF no cambia al meter «Código»: se le
            // restan los puntos a Descripción y Detalle, que son las dos
            // que sobraban. Pasarse del total desborda la caja.
            { titulo: '#', ancho: 6, anchoPdf: 26 },
            { titulo: 'Código', ancho: 14, anchoPdf: 60 },
            { titulo: 'Descripción', ancho: 34, anchoPdf: 150 },
            { titulo: 'Unidad', ancho: 10, anchoPdf: 50 },
            {
              titulo: 'Cantidad',
              ancho: 10,
              anchoPdf: 56,
              derecha: true,
              formato: '#,##0',
            },
            { titulo: 'Detalle', ancho: 24, anchoPdf: 90 },
            { titulo: 'Referencias', ancho: 24, anchoPdf: 88 },
          ],
          filas: req.items.map((i, n) => [
            n + 1,
            guion(i.codigoProducto),
            i.descripcion,
            i.unidad,
            i.cantidad,
            guion(i.detalleObservacion),
            guion(i.referencias),
          ]),
          vacio: 'El requerimiento todavía no tiene ítems.',
        },
      ],
    };
  }

  /**
   * El comparativo de §37: lo que ofreció cada proveedor.
   *
   * Dos bloques porque son dos decisiones distintas —con quién trabajar
   * y quién es mejor en cada línea—, exactamente los mismos dos que
   * enseña la pantalla.
   *
   * Las descartadas y las pendientes de revisar SE INCLUYEN, marcadas en
   * su columna de estado: §40 le da al Aprobador derecho a ver todas las
   * cotizaciones, y un papel que esconde una de ellas es peor que la
   * pantalla. Lo que no hacen es contar para el mejor precio, y de eso
   * ya se encargó `ComparacionService`.
   */
  async comparativo(
    usuario: UsuarioAutenticado,
    id: number,
  ): Promise<Exportable> {
    const req = await this.requerimientos.detalle(usuario, id);
    const c = await this.comparacion.comparar(usuario, id);

    const porProveedor: BloqueExportable = {
      titulo: 'Cotizaciones recibidas',
      columnas: [
        { titulo: 'Proveedor', ancho: 34, anchoPdf: 150 },
        { titulo: 'RUC', ancho: 14, anchoPdf: 70 },
        { titulo: 'Estado', ancho: 14, anchoPdf: 72 },
        { titulo: 'Cubre', ancho: 8, anchoPdf: 40, derecha: true },
        { titulo: 'Plazo', ancho: 18, anchoPdf: 76 },
        { titulo: 'Garantía', ancho: 14, anchoPdf: 62 },
        {
          titulo: 'Total S/',
          ancho: 14,
          anchoPdf: 80,
          derecha: true,
          formato: '#,##0.00',
        },
      ],
      filas: c.proveedores.map((p) => [
        p.proveedor,
        guion(p.ruc),
        p.requiereRevision
          ? 'A revisar'
          : (ESTADO_COTIZACION[p.estado] ?? p.estado),
        `${String(p.itemsCubiertos)}/${String(c.totalItemsPedidos)}`,
        guion(p.plazoEntrega),
        guion(p.garantia),
        p.total,
      ]),
      vacio: 'Todavía no se ha registrado ninguna cotización.',
    };

    // Una fila por ítem y por oferta: es la forma que se puede leer en
    // una tabla plana sin perder de vista a qué ítem pertenece cada
    // precio. En pantalla se pliega; en papel no hay dónde plegar.
    const porItem: BloqueExportable = {
      titulo: 'Detalle por ítem',
      columnas: [
        { titulo: '#', ancho: 6, anchoPdf: 24 },
        { titulo: 'Ítem', ancho: 32, anchoPdf: 140 },
        {
          titulo: 'Cant.',
          ancho: 8,
          anchoPdf: 42,
          derecha: true,
          formato: '#,##0',
        },
        { titulo: 'Proveedor', ancho: 28, anchoPdf: 120 },
        {
          titulo: 'P. unit. S/',
          ancho: 13,
          anchoPdf: 70,
          derecha: true,
          formato: '#,##0.00',
        },
        {
          titulo: 'Subtotal S/',
          ancho: 13,
          anchoPdf: 74,
          derecha: true,
          formato: '#,##0.00',
        },
      ],
      filas: c.items.flatMap((item) =>
        item.ofertas.length === 0
          ? [
              [
                item.orden + 1,
                `${item.descripcion} (${item.unidad})`,
                item.cantidad,
                'Nadie lo cotizó',
                '—',
                '—',
              ],
            ]
          : item.ofertas.map((o) => [
              item.orden + 1,
              `${item.descripcion} (${item.unidad})`,
              item.cantidad,
              o.estado === 'DESCARTADA'
                ? `${o.proveedor} (descartada)`
                : o.proveedor,
              o.precioUnitario,
              o.subtotal,
            ]),
      ),
      vacio: 'Sin ofertas que comparar.',
    };

    const bloques = [porProveedor, porItem];

    // §36: lo que el proveedor añadió por su cuenta cuenta en su total,
    // así que tiene que verse o el papel no cuadra.
    if (c.extras.length > 0)
      bloques.push({
        titulo: 'Líneas añadidas por los proveedores',
        columnas: [
          { titulo: 'Proveedor', ancho: 30, anchoPdf: 140 },
          { titulo: 'Concepto', ancho: 36, anchoPdf: 170 },
          {
            titulo: 'Cant.',
            ancho: 8,
            anchoPdf: 44,
            derecha: true,
            formato: '#,##0.00',
          },
          {
            titulo: 'P. unit. S/',
            ancho: 13,
            anchoPdf: 76,
            derecha: true,
            formato: '#,##0.00',
          },
          {
            titulo: 'Subtotal S/',
            ancho: 13,
            anchoPdf: 80,
            derecha: true,
            formato: '#,##0.00',
          },
        ],
        filas: c.extras.map((o) => [
          o.proveedor,
          o.descripcion,
          o.cantidad,
          o.precioUnitario,
          o.subtotal,
        ]),
      });

    return {
      titulo: `Comparativo de cotizaciones ${req.numero ?? ''}`.trim(),
      nombreArchivo: `comparativo-${req.numero ?? String(req.id)}`,
      datos: [
        { etiqueta: 'N.º de pedido', valor: req.numero ?? '(sin número)' },
        { etiqueta: 'Estado', valor: ETIQUETA_ESTADO[req.estado] },
        { etiqueta: 'Cliente', valor: req.clienteNombre },
        { etiqueta: 'Ítems pedidos', valor: String(c.totalItemsPedidos) },
        { etiqueta: 'Cotizaciones', valor: String(c.proveedores.length) },
        {
          etiqueta: 'Total más bajo',
          valor:
            c.totalMasBajo === null
              ? 'ninguna compite'
              : `S/ ${c.totalMasBajo.toFixed(2)}`,
        },
      ],
      bloques,
    };
  }

  /**
   * El costo registrado (§51, §69).
   *
   * Lo que finalmente se pagó, con el proveedor de la cotización
   * aprobada. Es el documento que cierra el expediente.
   */
  async costo(usuario: UsuarioAutenticado, id: number): Promise<Exportable> {
    const req = await this.requerimientos.detalle(usuario, id);
    // Si no hay costo, `detalle` ya corta con su propio mensaje: no se
    // repite aquí para no tener dos redacciones del mismo hecho.
    const costo = await this.costos.detalle(usuario, id);

    return {
      titulo: `Costo ${req.numero ?? ''}`.trim(),
      nombreArchivo: `costo-${req.numero ?? String(req.id)}`,
      datos: [
        { etiqueta: 'N.º de pedido', valor: req.numero ?? '(sin número)' },
        { etiqueta: 'Cliente', valor: req.clienteNombre },
        { etiqueta: 'Proveedor', valor: costo.proveedorRazonSocial },
        { etiqueta: 'RUC', valor: guion(costo.proveedorRuc) },
        { etiqueta: 'Teléfono', valor: guion(costo.proveedorTelefono) },
        {
          etiqueta: 'Registrado por',
          valor: guion(costo.registradoPor?.nombre),
        },
        { etiqueta: 'Fecha de registro', valor: dia(costo.creadoEn) },
        { etiqueta: 'Lugar de entrega', valor: req.lugarEntrega },
      ],
      bloques: [
        {
          titulo: 'Costo por ítem',
          columnas: [
            { titulo: '#', ancho: 6, anchoPdf: 26 },
            { titulo: 'Descripción', ancho: 38, anchoPdf: 180 },
            { titulo: 'Unidad', ancho: 10, anchoPdf: 50 },
            {
              titulo: 'Cantidad',
              ancho: 10,
              anchoPdf: 58,
              derecha: true,
              formato: '#,##0',
            },
            {
              titulo: 'C. unit. S/',
              ancho: 14,
              anchoPdf: 78,
              derecha: true,
              formato: '#,##0.00',
            },
            {
              titulo: 'Total S/',
              ancho: 14,
              anchoPdf: 80,
              derecha: true,
              formato: '#,##0.00',
            },
          ],
          filas: costo.items.map((i, n) => [
            n + 1,
            i.descripcion,
            i.unidad,
            i.cantidad,
            i.costoUnitario,
            i.costoTotal,
          ]),
          // El total viene calculado del mismo sitio que la pantalla.
          filaFinal: ['', 'TOTAL', '', '', '', costo.total],
        },
      ],
    };
  }
}
