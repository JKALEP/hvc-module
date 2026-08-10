import { BadRequestException } from '@nestjs/common';

/**
 * Helpers de período mensual.
 *
 * La lista de meses generada aquí es la única fuente de verdad de "qué
 * meses están en juego": sirve a la vez para filtrar nomina_mensual, para
 * rellenar los meses sin datos (que deben salir como HUECO, no como cero)
 * y como eje X de la serie. Maneja el cruce de año sin casos especiales.
 */

export interface Mes {
  anio: number;
  mes: number; // 1–12
}

/**
 * Tope de meses por consulta. Guarda de cordura: un rango de años enteros
 * no es una pregunta de negocio, es un error de tipeo en el filtro.
 */
export const TOPE_MESES = 24;

const NOMBRES_MES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Oct',
  'Nov',
  'Dic',
];

/** Convierte "YYYY-MM" (valor de un <input type="month">) a Mes. */
export function aMes(valor: string, campo: string): Mes {
  const m = /^(\d{4})-(\d{2})$/.exec(valor.trim());
  if (!m)
    throw new BadRequestException(
      `El campo "${campo}" debe tener formato YYYY-MM. Recibido: "${valor}".`,
    );
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12)
    throw new BadRequestException(
      `El campo "${campo}" tiene un mes inválido: ${mes}.`,
    );
  return { anio, mes };
}

/** Índice absoluto del mes, para comparar y restar sin casos de borde. */
function indice(m: Mes): number {
  return m.anio * 12 + (m.mes - 1);
}

/** "2026-01" — clave estable, sirve de key en React. */
export function claveMes(m: Mes): string {
  return `${m.anio}-${String(m.mes).padStart(2, '0')}`;
}

/** "Ene 2026" — etiqueta corta para ejes y cabeceras de tabla. */
export function etiquetaMes(m: Mes): string {
  return `${NOMBRES_MES[m.mes - 1]} ${m.anio}`;
}

/**
 * Todos los meses del rango, inclusive en ambos extremos.
 * Cruza el año sin tratamiento especial (nov-2025 → feb-2026).
 */
export function listarMeses(desde: Mes, hasta: Mes): Mes[] {
  if (indice(desde) > indice(hasta))
    throw new BadRequestException(
      'El mes "desde" no puede ser posterior al mes "hasta".',
    );

  const total = indice(hasta) - indice(desde) + 1;
  if (total > TOPE_MESES)
    throw new BadRequestException(
      `El rango tiene ${total} meses y el máximo es ${TOPE_MESES}. Acota el período.`,
    );

  const meses: Mes[] = [];
  for (let i = 0; i < total; i++) {
    const abs = indice(desde) + i;
    meses.push({ anio: Math.floor(abs / 12), mes: (abs % 12) + 1 });
  }
  return meses;
}

/** Primer día del mes, a medianoche UTC (los campos son @db.Date). */
export function primerDia(m: Mes): Date {
  return new Date(Date.UTC(m.anio, m.mes - 1, 1));
}

/** Último día del mes, a medianoche UTC. */
export function ultimoDia(m: Mes): Date {
  // Día 0 del mes siguiente = último día de este.
  return new Date(Date.UTC(m.anio, m.mes, 0));
}

/** Rango de fechas que cubre la lista completa de meses. */
export function rangoDeMeses(meses: Mes[]): { desde: Date; hasta: Date } {
  return {
    desde: primerDia(meses[0]),
    hasta: ultimoDia(meses[meses.length - 1]),
  };
}
