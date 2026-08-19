import type {
  TipoDocumento,
  EstadoCotizacion,
  EstadoOrdenCompra,
  LineaBorrador,
  LineaDocumento,
} from '@/modules/equipos/types';

/**
 * Lo que la app sabe de cotizaciones y órdenes, en un solo sitio.
 *
 * Los dos documentos comparten pantalla y componentes, así que lo que
 * los distingue —etiquetas, estados, a dónde vuelve el botón de atrás—
 * vive junto en vez de repartido en `if (tipo === …)` por todas partes.
 */

export const ETIQUETA_DOCUMENTO: Record<
  TipoDocumento,
  { singular: string; plural: string; prefijo: string }
> = {
  cotizacion: {
    singular: 'Cotización',
    plural: 'Cotizaciones',
    prefijo: 'COT',
  },
  'orden-compra': {
    singular: 'Orden de compra',
    plural: 'Órdenes de compra',
    prefijo: 'OC',
  },
};

/** Los estados que ofrece cada documento, con su etiqueta y su color. */
export const ESTADOS_DOCUMENTO: Record<
  TipoDocumento,
  {
    valor: string;
    etiqueta: string;
    variante: 'secondary' | 'success' | 'warning' | 'destructive';
  }[]
> = {
  cotizacion: [
    { valor: 'PENDIENTE', etiqueta: 'Pendiente', variante: 'warning' },
    { valor: 'APROBADA', etiqueta: 'Aprobada', variante: 'success' },
    { valor: 'RECHAZADA', etiqueta: 'Rechazada', variante: 'destructive' },
  ],
  'orden-compra': [
    { valor: 'EMITIDA', etiqueta: 'Emitida', variante: 'secondary' },
    { valor: 'EN_PROCESO', etiqueta: 'En proceso', variante: 'warning' },
    { valor: 'ATENDIDA', etiqueta: 'Atendida', variante: 'success' },
    { valor: 'CANCELADA', etiqueta: 'Cancelada', variante: 'destructive' },
  ],
};

export function estadoDe(tipo: TipoDocumento, valor: string) {
  return (
    ESTADOS_DOCUMENTO[tipo].find((e) => e.valor === valor) ?? {
      valor,
      etiqueta: valor,
      variante: 'secondary' as const,
    }
  );
}

export type EstadoDocumento = EstadoCotizacion | EstadoOrdenCompra;

/** Importe con dos decimales y separador de miles. Un solo formato. */
export function dinero(n: number): string {
  return n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * El subtotal de una línea que se está escribiendo.
 *
 * Se calcula en el navegador con la MISMA fórmula del backend
 * (`DocumentoService.calcularLineas`) para que el total se mueva
 * mientras se teclea. La cifra que vale es siempre la que devuelve el
 * servidor al guardar; esto es solo el eco inmediato.
 */
export function subtotalDe(linea: LineaBorrador): number {
  const cantidad = Number(linea.cantidad.replace(/,/g, ''));
  const precio = Number(linea.precioUnitario.replace(/,/g, ''));
  if (!Number.isFinite(cantidad) || !Number.isFinite(precio)) return 0;
  return Math.round(cantidad * precio * 100) / 100;
}

export function totalDe(lineas: LineaBorrador[]): number {
  return Math.round(lineas.reduce((a, l) => a + subtotalDe(l), 0) * 100) / 100;
}

/** Las líneas guardadas → borradores editables. */
export function aBorradores(lineas: LineaDocumento[]): LineaBorrador[] {
  return lineas.map((l) => ({
    descripcion: l.descripcion,
    cantidad: String(l.cantidad),
    precioUnitario: String(l.precioUnitario),
  }));
}

export const LINEA_VACIA: LineaBorrador = {
  descripcion: '',
  cantidad: '1',
  precioUnitario: '0',
};
