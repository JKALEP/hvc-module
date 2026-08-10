import { BadRequestException } from '@nestjs/common';

/**
 * Helpers de fecha compartidos por los módulos que trabajan con campos
 * @db.Date (día calendario, sin hora).
 */

/**
 * Convierte "YYYY-MM-DD" a Date a medianoche UTC.
 * Los campos son @db.Date: guardar y comparar en UTC evita que la zona
 * horaria de Lima (UTC-5) corra el día.
 */
export function aFechaUTC(valor: string, campo: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
  if (!m)
    throw new BadRequestException(
      `El campo "${campo}" debe tener formato YYYY-MM-DD. Recibido: "${valor}".`,
    );
  const fecha = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  );
  if (isNaN(fecha.getTime()))
    throw new BadRequestException(
      `El campo "${campo}" no es una fecha válida.`,
    );
  return fecha;
}

/** Clave estable de un día calendario ("YYYY-MM-DD"), para contar días distintos. */
export function claveDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Construye el filtro de rango de Prisma a partir de desde/hasta opcionales.
 * Devuelve undefined si no hay rango, para no ensuciar el `where`.
 */
export function rangoDeFechas(
  desde?: string,
  hasta?: string,
): { gte?: Date; lte?: Date } | undefined {
  const d = desde ? aFechaUTC(desde, 'desde') : undefined;
  const h = hasta ? aFechaUTC(hasta, 'hasta') : undefined;

  if (d && h && d > h)
    throw new BadRequestException(
      'El campo "desde" no puede ser posterior a "hasta".',
    );

  if (!d && !h) return undefined;
  return { ...(d ? { gte: d } : {}), ...(h ? { lte: h } : {}) };
}

/** Redondea a `decimales` y devuelve number, o null si no hay valor. */
export function redondear(valor: number | null, decimales = 2): number | null {
  if (valor === null || isNaN(valor)) return null;
  return Number(valor.toFixed(decimales));
}
