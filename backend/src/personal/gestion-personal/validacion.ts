import { BadRequestException } from '@nestjs/common';
import { TipoPersonal, CampoPersonal } from '../../../generated/prisma/enums';
import { limpiar, describir } from '../../common/texto';
import type { DatosFichaDto } from './dto';

/**
 * Validación de la lista SCTR, a mano y en español.
 *
 * Es más estricta que el resto del sistema a propósito: `Trabajador`
 * acepta casi todo porque se carga por SQL y sus campos son
 * informativos, pero esto es un documento que se presenta a
 * fiscalización — una fila incompleta invalida el trámite.
 */

/** Los 13 campos en el orden EXACTO del Excel, columnas A→M. */
export const COLUMNAS = [
  'nombres',
  'apellidoPaterno',
  'apellidoMaterno',
  'tipoTrabajador',
  'paisNacimiento',
  'tipoDocumento',
  'numeroDocumento',
  'sexo',
  'fechaNacimiento',
  'moneda',
  'remuneracion',
  'estadoCivil',
  'sede',
] as const;

/**
 * Las etiquetas que se escriben al exportar. Son las del archivo real de
 * HVC, erratas incluidas («AP. PARTENO»): el documento tiene que salir
 * igual al que se viene presentando.
 */
export const ENCABEZADOS = [
  'NOMBRES',
  'AP. PARTENO',
  'AP.MATERNO',
  'TIPO DE TRABAJADOR',
  'PAIS NACIMIENTO',
  'TPO IDENT',
  'NUM. IDENT',
  'SEXO',
  'F. NACIMIENTO',
  'MONEDA',
  'REMUNERACIÓN',
  'ESTADO CIVIL',
  'SEDE',
] as const;

/** Nombre visible de cada campo, para los mensajes de error. */
const ETIQUETA: Record<(typeof COLUMNAS)[number], string> = {
  nombres: 'NOMBRES',
  apellidoPaterno: 'AP. PATERNO',
  apellidoMaterno: 'AP. MATERNO',
  tipoTrabajador: 'TIPO DE TRABAJADOR',
  paisNacimiento: 'PAÍS NACIMIENTO',
  tipoDocumento: 'TPO IDENT',
  numeroDocumento: 'NUM. IDENT',
  sexo: 'SEXO',
  fechaNacimiento: 'F. NACIMIENTO',
  moneda: 'MONEDA',
  remuneracion: 'REMUNERACIÓN',
  estadoCivil: 'ESTADO CIVIL',
  sede: 'SEDE',
};

export const MESES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SETIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
] as const;

/** Color por defecto de la fila de grupo, según el tipo. */
export const COLOR_POR_TIPO: Record<TipoPersonal, string> = {
  CONTRATISTA: 'FFC000', // hoja OPERATIVO
  SUPERVISOR: '3B7D23', // hoja SUPERVISORES
};

// ── Conversores ──

export function aAnio(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 2000 || n > 2100)
    throw new BadRequestException(
      `Año inválido: "${describir(valor)}". Debe estar entre 2000 y 2100.`,
    );
  return n;
}

export function aMes(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 12)
    throw new BadRequestException(
      `Mes inválido: "${describir(valor)}". Debe ser un número del 1 al 12.`,
    );
  return n;
}

export function aTipo(valor: unknown): TipoPersonal {
  const s = limpiar(valor)?.toUpperCase();
  if (s === 'SUPERVISOR' || s === 'CONTRATISTA') return s;
  throw new BadRequestException(
    `Tipo inválido: "${describir(valor)}". Valores permitidos: SUPERVISOR, CONTRATISTA.`,
  );
}

export function aCampo(valor: unknown): CampoPersonal {
  const s = limpiar(valor)?.toUpperCase();
  const validos = Object.values(CampoPersonal) as string[];
  if (s && validos.includes(s)) return s as CampoPersonal;
  throw new BadRequestException(
    `Campo inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
  );
}

/**
 * Hex de 6 dígitos, sin almohadilla y en mayúsculas.
 * Acepta "#FFC000", "ffc000" y "FFFFC000" (ARGB de Excel: se le quita
 * el canal alfa, que en un relleno de celda siempre es opaco).
 */
export function aColor(valor: unknown, porDefecto: string): string {
  const s = limpiar(valor);
  if (!s) return porDefecto;
  let hex = s.replace(/^#/, '').toUpperCase();
  if (hex.length === 8) hex = hex.slice(2);
  if (!/^[0-9A-F]{6}$/.test(hex))
    throw new BadRequestException(
      `Color inválido: "${describir(valor)}". Debe ser un hexadecimal de 6 dígitos, por ejemplo FFC000.`,
    );
  return hex;
}

/**
 * Fecha de calendario a UTC medianoche.
 *
 * Acepta dd/mm/aaaa (lo que traen los Excel de HVC), aaaa-mm-dd (lo que
 * manda un <input type="date">) y un Date ya resuelto por la librería
 * de Excel. Los tres conviven en los archivos reales.
 */
export function aFechaNacimiento(valor: unknown): Date {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return new Date(
      Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()),
    );
  }

  const s = limpiar(valor);
  if (!s) throw new BadRequestException('La F. NACIMIENTO es obligatoria.');

  const barras = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  let anio: number, mes: number, dia: number;
  if (barras) {
    dia = Number(barras[1]);
    mes = Number(barras[2]);
    anio = Number(barras[3]);
  } else if (iso) {
    anio = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else {
    throw new BadRequestException(
      `F. NACIMIENTO inválida: "${describir(valor)}". Usa el formato dd/mm/aaaa.`,
    );
  }

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  // Rebota "31/02/2000": el Date se desborda a marzo y deja de coincidir.
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  )
    throw new BadRequestException(
      `F. NACIMIENTO inválida: "${describir(valor)}". Ese día no existe.`,
    );
  if (anio < 1900 || fecha.getTime() > Date.now())
    throw new BadRequestException(
      `F. NACIMIENTO fuera de rango: "${describir(valor)}".`,
    );
  return fecha;
}

/**
 * NUM. IDENT — SIEMPRE texto.
 *
 * En los archivos reales 136 de 573 vienen como número de Excel, y los
 * que son texto traen espacios sobrantes ("47865929  "). Sin el trim,
 * la unicidad del periodo trataría "47865929" y "47865929 " como dos
 * personas distintas.
 */
export function aNumeroDocumento(valor: unknown): string {
  let s: string;
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor))
      throw new BadRequestException('El NUM. IDENT no es válido.');
    // Sin notación científica y sin decimales: es un identificador.
    s = valor.toFixed(0);
  } else {
    s = limpiar(valor) ?? '';
  }
  s = s.replace(/\s+/g, '');
  // Excel marca «esto es texto» con un apóstrofo o un acento grave
  // delante. Normalmente no llega al valor, pero en el archivo de
  // febrero sí: "`07490746".
  s = s.replace(/^['`´]+/, '');
  if (s === '') throw new BadRequestException('El NUM. IDENT es obligatorio.');
  if (!/^[0-9A-Za-z-]{4,20}$/.test(s))
    throw new BadRequestException(
      `NUM. IDENT inválido: "${describir(valor)}". Debe tener entre 4 y 20 caracteres, sin espacios ni símbolos.`,
    );
  return s;
}

export function aRemuneracion(valor: unknown): string {
  const n =
    typeof valor === 'number'
      ? valor
      : Number(limpiar(valor)?.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0)
    throw new BadRequestException(
      `REMUNERACIÓN inválida: "${describir(valor)}". Debe ser un número mayor o igual a 0.`,
    );
  if (n > 9_999_999_999)
    throw new BadRequestException('La REMUNERACIÓN excede el máximo admitido.');
  return n.toFixed(2);
}

/** Datos ya validados y listos para escribir. */
export interface FichaNormalizada {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  tipoTrabajador: string;
  paisNacimiento: string;
  tipoDocumento: string;
  numeroDocumento: string;
  sexo: string;
  fechaNacimiento: Date;
  moneda: string;
  remuneracion: string;
  estadoCivil: string;
  sede: string;
}

/** Texto obligatorio, con trim. Los Excel traen espacios sueltos. */
function texto(valor: unknown, campo: (typeof COLUMNAS)[number]): string {
  const s = limpiar(valor);
  if (!s)
    throw new BadRequestException(
      `El campo ${ETIQUETA[campo]} es obligatorio.`,
    );
  return s;
}

/**
 * AP. MATERNO es el ÚNICO de los 13 que admite vacío.
 *
 * El documento funcional los pedía todos obligatorios, pero las listas
 * que HVC ya presenta traen la celda vacía para el personal extranjero
 * con un solo apellido (venezolanos con CE). Exigirlo dejaría fuera de
 * la importación a gente que hoy sí figura en el documento presentado.
 */
function textoOpcional(valor: unknown): string {
  return limpiar(valor) ?? '';
}

/**
 * Valida los 13 campos de golpe. Ninguno es omitible: el documento se
 * presenta completo o no se presenta.
 */
export function normalizarFicha(dto: DatosFichaDto): FichaNormalizada {
  return {
    nombres: texto(dto.nombres, 'nombres'),
    apellidoPaterno: texto(dto.apellidoPaterno, 'apellidoPaterno'),
    apellidoMaterno: textoOpcional(dto.apellidoMaterno),
    tipoTrabajador: texto(dto.tipoTrabajador, 'tipoTrabajador'),
    paisNacimiento: texto(dto.paisNacimiento, 'paisNacimiento'),
    tipoDocumento: texto(dto.tipoDocumento, 'tipoDocumento'),
    numeroDocumento: aNumeroDocumento(dto.numeroDocumento),
    sexo: texto(dto.sexo, 'sexo'),
    fechaNacimiento: aFechaNacimiento(dto.fechaNacimiento),
    moneda: texto(dto.moneda, 'moneda'),
    remuneracion: aRemuneracion(dto.remuneracion),
    estadoCivil: texto(dto.estadoCivil, 'estadoCivil'),
    sede: texto(dto.sede, 'sede'),
  };
}

/** Lista de ids para las acciones en lote (mover, eliminar selección). */
export function aListaDeIds(valor: unknown, campo: string): number[] {
  if (!Array.isArray(valor) || valor.length === 0)
    throw new BadRequestException(
      `El campo "${campo}" debe traer al menos un id.`,
    );
  const ids = valor.map((v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0)
      throw new BadRequestException(
        `El campo "${campo}" contiene un id inválido: "${describir(v)}".`,
      );
    return n;
  });
  return [...new Set(ids)];
}
