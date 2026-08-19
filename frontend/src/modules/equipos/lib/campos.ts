import type {
  TipoCampo,
  ValorFicha,
  ValoresEquipo,
} from '@/modules/equipos/types';

/**
 * Lo que la app sabe sobre los tipos de campo, en un solo sitio.
 *
 * Lo consultan el selector de tipo al crear un campo, el formulario
 * dinámico y la tabla de inventario; tenerlo junto evita que las tres
 * pantallas discrepen sobre cómo se llama o se lee un tipo.
 */

export const ETIQUETA_TIPO: Record<TipoCampo, string> = {
  TEXTO: 'Texto',
  TEXTO_LARGO: 'Texto largo',
  NUMERO_ENTERO: 'Número entero',
  NUMERO_DECIMAL: 'Número decimal',
  MONEDA: 'Moneda',
  FECHA: 'Fecha',
  FECHA_HORA: 'Fecha y hora',
  BOOLEANO: 'Sí / No',
  LISTA: 'Lista',
  SELECCION_MULTIPLE: 'Selección múltiple',
  ARCHIVO: 'Archivo',
  IMAGEN: 'Imagen',
  CORREO: 'Correo',
  TELEFONO: 'Teléfono',
  URL: 'Enlace',
};

/** Los dos que necesitan opciones. Mismo criterio que el backend. */
export const TIPOS_CON_OPCIONES: TipoCampo[] = ['LISTA', 'SELECCION_MULTIPLE'];

/** El orden en que se ofrecen al crear un campo: lo común primero. */
export const TIPOS_ORDENADOS: TipoCampo[] = [
  'TEXTO',
  'LISTA',
  'NUMERO_ENTERO',
  'NUMERO_DECIMAL',
  'MONEDA',
  'FECHA',
  'BOOLEANO',
  'SELECCION_MULTIPLE',
  'TEXTO_LARGO',
  'FECHA_HORA',
  'CORREO',
  'TELEFONO',
  'URL',
  'ARCHIVO',
  'IMAGEN',
];

/**
 * La ficha del backend → lo que el formulario espera.
 *
 * Cada tipo guarda su valor en una columna distinta, así que hay que
 * volver a la forma que el control necesita: un id para LISTA, un array
 * de ids para SELECCION_MULTIPLE, texto para el resto.
 */
export function aValoresDeFormulario(valores: ValorFicha[]): ValoresEquipo {
  const salida: ValoresEquipo = {};
  for (const v of valores) {
    switch (v.campo.tipo) {
      case 'LISTA':
        salida[v.campo.clave] = v.opcion?.id ?? null;
        break;
      case 'SELECCION_MULTIPLE':
        salida[v.campo.clave] = v.opciones.map((o) => o.id);
        break;
      case 'BOOLEANO':
        salida[v.campo.clave] = v.valorBooleano;
        break;
      case 'NUMERO_ENTERO':
        salida[v.campo.clave] = v.valorEntero ?? '';
        break;
      case 'NUMERO_DECIMAL':
      case 'MONEDA':
        salida[v.campo.clave] = v.valorNumero ?? '';
        break;
      case 'FECHA':
        // El <input type="date"> quiere aaaa-mm-dd pelado.
        salida[v.campo.clave] = v.valorFecha?.slice(0, 10) ?? '';
        break;
      case 'FECHA_HORA':
        salida[v.campo.clave] = v.valorFecha?.slice(0, 16) ?? '';
        break;
      case 'ARCHIVO':
      case 'IMAGEN':
        salida[v.campo.clave] = v.claveArchivo ?? '';
        break;
      default:
        salida[v.campo.clave] = v.valorTexto ?? '';
    }
  }
  return salida;
}
