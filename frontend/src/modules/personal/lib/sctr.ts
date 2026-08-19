import type { TipoPersonal, DatosFicha, CampoPersonal } from '@/modules/personal/types';

/**
 * Las constantes de la lista SCTR.
 *
 * Viven aquí y no dentro de los componentes porque las comparten varios
 * —la tabla, la cabecera de grupo y los diálogos— y porque un archivo
 * que exporta a la vez un componente y una constante rompe el
 * hot-reload de Vite.
 */

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Cómo se llama un grupo según el tipo del periodo. */
export const ETIQUETA_GRUPO: Record<TipoPersonal, string> = {
  SUPERVISOR: 'Área',
  CONTRATISTA: 'Empresa contratista',
};

/**
 * Las 13 columnas, en el orden EXACTO del Excel.
 *
 * El orden no es decorativo: el importador lee por posición A→M y el
 * exportador escribe en el mismo orden, así que esta lista y la del
 * backend describen el mismo documento.
 */
export const COLUMNAS: {
  clave: keyof DatosFicha;
  etiqueta: string;
  ancho: string;
  catalogo?: CampoPersonal;
  tipo?: 'fecha' | 'numero';
}[] = [
  { clave: 'nombres', etiqueta: 'NOMBRES', ancho: 'w-40' },
  { clave: 'apellidoPaterno', etiqueta: 'AP. PATERNO', ancho: 'w-32' },
  { clave: 'apellidoMaterno', etiqueta: 'AP. MATERNO', ancho: 'w-32' },
  {
    clave: 'tipoTrabajador',
    etiqueta: 'TIPO DE TRABAJADOR',
    ancho: 'w-36',
    catalogo: 'TIPO_TRABAJADOR',
  },
  {
    clave: 'paisNacimiento',
    etiqueta: 'PAÍS NACIMIENTO',
    ancho: 'w-32',
    catalogo: 'PAIS_NACIMIENTO',
  },
  {
    clave: 'tipoDocumento',
    etiqueta: 'TPO IDENT',
    ancho: 'w-20',
    catalogo: 'TIPO_DOCUMENTO',
  },
  { clave: 'numeroDocumento', etiqueta: 'NUM. IDENT', ancho: 'w-28' },
  { clave: 'sexo', etiqueta: 'SEXO', ancho: 'w-16', catalogo: 'SEXO' },
  {
    clave: 'fechaNacimiento',
    etiqueta: 'F. NACIMIENTO',
    ancho: 'w-32',
    tipo: 'fecha',
  },
  { clave: 'moneda', etiqueta: 'MONEDA', ancho: 'w-20', catalogo: 'MONEDA' },
  {
    clave: 'remuneracion',
    etiqueta: 'REMUNERACIÓN',
    ancho: 'w-24',
    tipo: 'numero',
  },
  {
    clave: 'estadoCivil',
    etiqueta: 'ESTADO CIVIL',
    ancho: 'w-28',
    catalogo: 'ESTADO_CIVIL',
  },
  { clave: 'sede', etiqueta: 'SEDE', ancho: 'w-28', catalogo: 'SEDE' },
];
