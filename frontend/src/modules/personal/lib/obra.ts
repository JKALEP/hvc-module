import type { EstadoProyecto } from '@/modules/personal/types';

/**
 * Reglas visibles del módulo de obra, en un solo sitio.
 *
 * El estado y los días de atraso los calcula el backend; aquí solo se
 * decide cómo se ven. Tenerlo junto evita que la tarjeta del explorador
 * y la cabecera de la ficha discrepen en un umbral.
 */

export const ETIQUETA_ESTADO: Record<EstadoProyecto, string> = {
  INICIO: 'Inicio',
  EN_PROCESO: 'En proceso',
  FINALIZADO: 'Finalizado',
};

export const VARIANTE_ESTADO: Record<
  EstadoProyecto,
  'secondary' | 'warning' | 'success'
> = {
  INICIO: 'secondary',
  EN_PROCESO: 'warning',
  FINALIZADO: 'success',
};

/**
 * Umbrales de atraso. Coinciden con los filtros del explorador para que
 * «4+ días» seleccione exactamente lo que la insignia pinta en ámbar.
 *
 * ⚠ La fórmula que produce `diasAtraso` es una PROPUESTA NO VALIDADA con
 * el negocio (ver `calculo-obra.service.ts` en el backend): supone que el
 * avance esperado crece linealmente en el tiempo.
 */
export const ATRASO_LEVE = 4;
export const ATRASO_SEVERO = 10;

export function etiquetaAtraso(dias: number): {
  texto: string;
  variante: 'success' | 'warning' | 'destructive';
} {
  if (dias < 1) return { texto: 'En tiempo', variante: 'success' };
  return {
    texto: `${dias} día${dias === 1 ? '' : 's'} de atraso`,
    variante: dias >= ATRASO_SEVERO ? 'destructive' : 'warning',
  };
}

/** Producción por debajo de 100 % y calificación por debajo de 70 %: en rojo. */
export const UMBRAL_PRODUCCION = 100;
export const UMBRAL_CALIFICACION = 70;

export function claseSiBaja(
  valor: number | null,
  umbral: number,
): string {
  if (valor === null) return 'text-muted-foreground';
  return valor < umbral
    ? 'text-destructive'
    : 'text-foreground';
}

/** Fechas de un rango, inclusivas, en aaaa-mm-dd. */
export function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const d = new Date(`${desde}T00:00:00.000Z`);
  const fin = new Date(`${hasta}T00:00:00.000Z`);
  // Tope de seguridad: una obra mal capturada con fin en 2099 no puede
  // colgar el navegador generando 27.000 columnas.
  let guarda = 0;
  while (d <= fin && guarda++ < 2000) {
    dias.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}

/** «12 ago» — encabezado corto para una columna de fecha. */
export function fechaCorta(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Filtros del explorador ──
// Viven aquí y no en el componente porque el componente que los pinta y
// la página que los aplica son dos archivos distintos.

export type FiltroEstado = 'TODOS' | EstadoProyecto;
export type FiltroAtraso = 'TODOS' | 'ALGUNO' | 'LEVE' | 'SEVERO';

/** Se combinan con Y: no son excluyentes. */
export function filtrarProyectos<
  T extends { estado: EstadoProyecto; diasAtraso: number },
>(proyectos: T[], estado: FiltroEstado, atraso: FiltroAtraso): T[] {
  return proyectos.filter((p) => {
    if (estado !== 'TODOS' && p.estado !== estado) return false;
    if (atraso === 'ALGUNO' && p.diasAtraso < 1) return false;
    if (atraso === 'LEVE' && p.diasAtraso < ATRASO_LEVE) return false;
    if (atraso === 'SEVERO' && p.diasAtraso < ATRASO_SEVERO) return false;
    return true;
  });
}

/**
 * Las filas de la grilla, en orden. Es lo que da de alta la estructura
 * transpuesta: aquí las filas son campos y las columnas fechas.
 */
export const FILAS_GRILLA = [
  { clave: 'equiposEjecutados', etiqueta: 'Equipos ejecutados', editable: true },
  { clave: 'equiposProgramados', etiqueta: 'Equipos programados', editable: true },
  { clave: 'produccion', etiqueta: 'Producción %', editable: false },
  { clave: 'avanceAcumulado', etiqueta: 'Avance acumulado %', editable: false },
  { clave: 'supervisor', etiqueta: 'Supervisor del día', editable: true },
  { clave: 'apoyo', etiqueta: 'Apoyo del día', editable: true },
  { clave: 'participantes', etiqueta: 'Personal participante', editable: true },
  {
    clave: 'contratistasProgramados',
    etiqueta: 'Contratistas programados',
    editable: true,
  },
  {
    clave: 'contratistasTrabajando',
    etiqueta: 'Contratistas trabajando',
    editable: false,
  },
  {
    clave: 'calificacionProveedor',
    etiqueta: 'Calif. del proveedor %',
    editable: false,
  },
] as const;



/** Alto de cada fila: las columnas fijas y las de fecha deben cuadrar. */
export const ALTO_FILA = 'h-10';
