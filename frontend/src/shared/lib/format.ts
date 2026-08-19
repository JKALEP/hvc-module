// Helpers de formato para la UI.

/** Formatea una fecha ISO a formato legible es-PE (dd/mm/aaaa hh:mm). */
export function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea un precio como moneda soles. Devuelve '—' si es null/vacío.
 *
 * Acepta number y string, igual que `formatPorcentaje`: los Decimal de
 * Prisma llegan como string, pero un backend que ya hizo la cuenta
 * —como la Base de Costos con el total de la línea— manda un número.
 */
export function formatPrecio(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = Number(valor);
  if (isNaN(n)) return String(valor);
  return `S/ ${n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Muestra un valor de texto o un guion si está vacío. */
export function orDash(valor: string | null | undefined): string {
  return valor === null || valor === undefined || valor === '' ? '—' : valor;
}

/** Formatea una fecha ISO como dd/mm/aaaa, sin hora. */
export function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  // Los campos @db.Date llegan a medianoche UTC: se leen en UTC para que
  // la zona horaria de Lima no muestre el día anterior.
  return d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Convierte una fecha ISO a "YYYY-MM-DD" para un <input type="date">. */
export function aValorInputFecha(iso: string): string {
  return iso.slice(0, 10);
}

/** "YYYY-MM-DD" de hoy, en hora local. */
export function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** "YYYY-MM-DD" del primer día del mes actual. */
export function inicioDeMesISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-01`;
}

/**
 * Formatea un porcentaje. Acepta number (indicadores) o string (Decimal
 * de Prisma). Devuelve '—' si es null: null significa "no calculable"
 * (denominador cero), que no es lo mismo que 0%.
 */
export function formatPorcentaje(
  valor: number | string | null | undefined,
  decimales = 1,
): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = Number(valor);
  if (isNaN(n)) return '—';
  return `${n.toFixed(decimales)}%`;
}

/** Formatea un entero con separador de miles. */
export function formatEntero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('es-PE');
}

/** "YYYY-MM" del mes en curso, para un <input type="month">. */
export function mesActualISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "YYYY-MM" de N meses atrás. */
export function mesRelativoISO(mesesAtras: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - mesesAtras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Último día de un mes "YYYY-MM", como "YYYY-MM-DD". */
export function finDeMes(mesISO: string): string {
  const [anio, mes] = mesISO.split('-').map(Number);
  // Día 0 del mes siguiente = último día de este.
  const d = new Date(Date.UTC(anio, mes, 0));
  return d.toISOString().slice(0, 10);
}

/**
 * "Actualizado hoy", "Act. hace 2 días", "Act. el 14/03/2026".
 *
 * Se corta a los 7 días: pasada una semana, "hace 23 días" obliga a hacer
 * la cuenta mentalmente y la fecha dice más.
 */
export function formatActualizado(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';

  const ahora = new Date();
  const minutos = Math.floor((ahora.getTime() - d.getTime()) / 60000);

  if (minutos < 1) return 'Actualizado ahora';
  if (minutos < 60) return `Act. hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  // "Hoy" y "ayer" se calculan por día de calendario, no por 24 h: a las
  // 00:30 lo de hace tres horas fue ayer, no hoy.
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dias = Math.round((hoy.getTime() - dia.getTime()) / 86400000);

  if (dias === 0) return horas < 1 ? 'Actualizado hoy' : `Act. hace ${horas} h`;
  if (dias === 1) return 'Act. ayer';
  if (dias <= 7) return `Act. hace ${dias} días`;
  return `Act. el ${formatFechaCorta(iso)}`;
}
