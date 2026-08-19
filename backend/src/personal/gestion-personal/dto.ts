import type {
  TipoPersonal,
  CampoPersonal,
} from '../../../generated/prisma/enums';

// Interfaces planas, sin class-validator: la validación se hace a mano en
// `validacion.ts` con mensajes en español.

// ── Periodo ──

export interface CrearPeriodoDto {
  anio?: number | string | null;
  mes?: number | string | null;
  tipo?: string | null;
  /** Hex sin almohadilla. Si falta, el que corresponda al tipo. */
  colorGrupo?: string | null;
}

export interface CopiarPeriodoDto extends CrearPeriodoDto {
  /**
   * De qué periodo copiar. Si se omite, el último anterior del mismo
   * tipo — que es el caso normal: «arranca el mes con lo del mes pasado».
   */
  desdePeriodoId?: number | string | null;
}

// ── Grupo ──

export interface CrearGrupoDto {
  periodoId?: number | string | null;
  nombre?: string | null;
}

export interface EditarGrupoDto {
  nombre?: string | null;
  orden?: number | string | null;
}

// ── Ficha ──

/** Los 13 campos del Excel. Todos obligatorios al crear. */
export interface DatosFichaDto {
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  tipoTrabajador?: string | null;
  paisNacimiento?: string | null;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  sexo?: string | null;
  /** dd/mm/aaaa o aaaa-mm-dd. */
  fechaNacimiento?: string | null;
  moneda?: string | null;
  remuneracion?: number | string | null;
  estadoCivil?: string | null;
  sede?: string | null;
}

export interface CrearFichaDto extends DatosFichaDto {
  grupoId?: number | string | null;
}

/** En la edición inline llega solo lo que cambió. */
export type EditarFichaDto = Partial<DatosFichaDto> & {
  grupoId?: number | string | null;
};

export interface MoverFichasDto {
  fichaIds?: unknown;
  grupoDestinoId?: number | string | null;
}

export interface EliminarFichasDto {
  fichaIds?: unknown;
}

// ── Catálogo ──

export interface CrearOpcionDto {
  campo?: string | null;
  valor?: string | null;
  orden?: number | string | null;
}

// ── Excel ──

/** Qué hacer con una ficha cuyo documento ya existe en el periodo. */
export type ResolucionConflicto = 'OMITIR' | 'SOBRESCRIBIR';

/** Una hoja del libro, ya mapeada por el usuario a un tipo y un periodo. */
export interface HojaAImportar {
  hoja?: string | null;
  tipo?: string | null;
  anio?: number | string | null;
  mes?: number | string | null;
  /** Si el usuario corrigió el color detectado. */
  colorGrupo?: string | null;
}

export interface ConfirmarImportacionDto {
  hojas?: unknown;
  /** Por defecto OMITIR: no pisa nada sin que se pida. */
  conflictos?: string | null;
}

// ── Formas devueltas ──

export interface BloqueDetectado {
  grupo: string;
  fila: number;
  personas: number;
}

export interface HojaDetectada {
  hoja: string;
  /** Hex resuelto del relleno de las filas de grupo. */
  colorGrupo: string | null;
  tipoSugerido: TipoPersonal | null;
  bloques: BloqueDetectado[];
  totalPersonas: number;
  /** Filas que no se pudieron leer, con el motivo. */
  problemas: { fila: number; motivo: string }[];
}

export interface OpcionCatalogo {
  id: number;
  campo: CampoPersonal;
  valor: string;
  orden: number;
}
