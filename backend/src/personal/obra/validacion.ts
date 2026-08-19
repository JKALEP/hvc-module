import { BadRequestException } from '@nestjs/common';
import { limpiar, describir } from '../../common/texto';
import type { EstadoProyecto } from './dto';

/** Fecha de calendario a UTC medianoche. Acepta aaaa-mm-dd y dd/mm/aaaa. */
export function aFecha(valor: unknown, campo: string): Date {
  const s = limpiar(valor);
  if (!s) throw new BadRequestException(`El campo "${campo}" es obligatorio.`);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const barras = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);

  let anio: number, mes: number, dia: number;
  if (iso) {
    [anio, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (barras) {
    [dia, mes, anio] = [
      Number(barras[1]),
      Number(barras[2]),
      Number(barras[3]),
    ];
  } else {
    throw new BadRequestException(
      `Fecha inválida en "${campo}": "${describir(valor)}". Usa aaaa-mm-dd.`,
    );
  }

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  // Rebota "31/02": el Date se desborda al mes siguiente y deja de coincidir.
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  )
    throw new BadRequestException(
      `Fecha inválida en "${campo}": "${describir(valor)}". Ese día no existe.`,
    );
  return fecha;
}

/** Entero >= 0. Los equipos y los contratistas nunca son negativos. */
export function aEntero(valor: unknown, campo: string): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0)
    throw new BadRequestException(
      `El campo "${campo}" debe ser un número entero mayor o igual a 0. Recibido: "${describir(valor)}".`,
    );
  return n;
}

/** Entero > 0. Para el total de equipos, que es un denominador. */
export function aEnteroPositivo(valor: unknown, campo: string): number {
  const n = aEntero(valor, campo);
  if (n === 0)
    throw new BadRequestException(
      `El campo "${campo}" debe ser mayor que 0: es el denominador del avance.`,
    );
  return n;
}

export function aTexto(valor: unknown, campo: string): string {
  const s = limpiar(valor);
  if (!s) throw new BadRequestException(`El campo "${campo}" es obligatorio.`);
  return s;
}

/**
 * ESTADO DEL PROYECTO — función pura del avance, nunca almacenada.
 *
 * Vive aquí y no en un enum de la base porque un estado guardado es un
 * caché de un cálculo: habría que reescribirlo en cada alta, edición y
 * borrado de jornada, y el día que uno de esos caminos fallara el
 * estado mentiría. PAUSADO no existe: no hay forma de derivarlo.
 */
export function estadoDeAvance(avance: number | null): EstadoProyecto {
  if (avance === null || avance <= 0) return 'INICIO';
  if (avance >= 100) return 'FINALIZADO';
  return 'EN_PROCESO';
}

/** Redondeo a 2 decimales, el mismo criterio de todo el sistema. */
export function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

/** aaaa-mm-dd de una fecha de calendario, sin desplazamiento de zona. */
export function claveFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
