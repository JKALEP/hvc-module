// Tipos del módulo Personal y proyectos.

// ── Gestión de personal (listas SCTR) ──

export type TipoPersonal = 'SUPERVISOR' | 'CONTRATISTA';

export type CampoPersonal =
  | 'TIPO_TRABAJADOR'
  | 'PAIS_NACIMIENTO'
  | 'TIPO_DOCUMENTO'
  | 'SEXO'
  | 'MONEDA'
  | 'ESTADO_CIVIL'
  | 'SEDE';

/** Qué hacer con quien ya está en el periodo al reimportar. */
export type ResolucionConflicto = 'SOBRESCRIBIR' | 'OMITIR';

export interface FichaPersonal {
  id: number;
  periodoId: number;
  grupoId: number;
  orden: number;
  nombres: string;
  apellidoPaterno: string;
  /** El único de los 13 que admite vacío. */
  apellidoMaterno: string;
  tipoTrabajador: string;
  paisNacimiento: string;
  tipoDocumento: string;
  /** SIEMPRE texto: conserva los ceros a la izquierda. */
  numeroDocumento: string;
  sexo: string;
  fechaNacimiento: string;
  moneda: string;
  remuneracion: string;
  estadoCivil: string;
  sede: string;
  actualizadoEn: string;
  actualizadoPor: { id: number; nombre: string } | null;
}

export interface GrupoPersonal {
  id: number;
  periodoId: number;
  nombre: string;
  orden: number;
  fichas: FichaPersonal[];
}

/** Lo que devuelve el detalle cuando el periodo TODAVÍA no existe. */
export interface PeriodoInexistente {
  existe: false;
  anio: number;
  mes: number;
  tipo: TipoPersonal;
  puedeCopiarDe: { id: number; anio: number; mes: number } | null;
}

export interface PeriodoCompleto {
  existe: true;
  id: number;
  anio: number;
  mes: number;
  tipo: TipoPersonal;
  colorGrupo: string;
  actualizadoEn: string;
  creadoPor: { id: number; nombre: string } | null;
  grupos: GrupoPersonal[];
}

export type DetallePeriodo = PeriodoCompleto | PeriodoInexistente;

export interface ResumenPeriodo {
  id: number;
  anio: number;
  mes: number;
  tipo: TipoPersonal;
  colorGrupo: string;
  actualizadoEn: string;
  creadoPor: { id: number; nombre: string } | null;
  grupos: number;
  personas: number;
}

export interface OpcionPersonal {
  id: number;
  campo: CampoPersonal;
  valor: string;
  orden: number;
}

export type Catalogo = Record<CampoPersonal, OpcionPersonal[]>;

// ── Importación ──

export interface BloqueDetectado {
  grupo: string;
  fila: number;
  personas: number;
}

export interface HojaDetectada {
  hoja: string;
  colorGrupo: string | null;
  tipoSugerido: TipoPersonal | null;
  bloques: BloqueDetectado[];
  totalPersonas: number;
  problemas: { fila: number; motivo: string }[];
}

/** Cómo se mapea cada hoja antes de confirmar. */
export interface HojaAImportar {
  hoja: string;
  tipo: TipoPersonal;
  anio: number;
  mes: number;
  colorGrupo?: string | null;
}

export interface ResultadoImportacion {
  hoja: string;
  anio: number;
  mes: number;
  tipo: TipoPersonal;
  gruposCreados: number;
  personasCreadas: number;
  personasSobrescritas: number;
  personasOmitidas: { fila: number; documento: string; motivo: string }[];
  filasConProblema: { fila: number; motivo: string }[];
}

/** Los 13 campos editables de una ficha. */
export type DatosFicha = Pick<
  FichaPersonal,
  | 'nombres'
  | 'apellidoPaterno'
  | 'apellidoMaterno'
  | 'tipoTrabajador'
  | 'paisNacimiento'
  | 'tipoDocumento'
  | 'numeroDocumento'
  | 'sexo'
  | 'fechaNacimiento'
  | 'moneda'
  | 'remuneracion'
  | 'estadoCivil'
  | 'sede'
>;

// ── Obra: carpetas, proyectos y jornadas ──

/** Se derivan del avance en el backend; nunca se guardan. */
export type EstadoProyecto = 'INICIO' | 'EN_PROCESO' | 'FINALIZADO';

export interface CarpetaObra {
  id: number;
  nombre: string;
  parentId?: number | null;
  ruta: string;
  subcarpetas?: number;
  proyectos?: number;
}

/** Si una asignación fija sigue figurando en el periodo vigente. */
export interface Vigencia {
  vigente: boolean;
  periodo: { anio: number; mes: number } | null;
}

/** Lo que muestra una tarjeta del explorador. */
export interface ProyectoTarjeta {
  id: number;
  nombre: string;
  sede: string;
  carpetaId: number | null;
  encargadoNombre: string;
  supervisorNombre: string;
  fechaInicio: string;
  fechaFinPrevista: string;
  totalEquipos: number;
  avance: number;
  estado: EstadoProyecto;
  avanceEsperado: number;
  diasAtraso: number;
  /** Serie de avance acumulado, para el sparkline. Sin ejes ni números. */
  tendencia: number[];
  jornadas: number;
}

export interface PuntoSerie {
  fecha: string;
  equiposEjecutados: number;
  equiposProgramados: number;
  produccion: number | null;
  avanceAcumulado: number;
  contratistasProgramados: number;
  contratistasTrabajando: number;
  calificacionProveedor: number | null;
}

export interface ProyectoDetalle {
  id: number;
  nombre: string;
  sede: string;
  carpetaId: number | null;
  fechaInicio: string;
  fechaFinPrevista: string;
  totalEquipos: number;
  encargadoNombre: string;
  supervisorNombre: string;
  supervisorFichaId: number;
  apoyoNombre: string | null;
  apoyoFichaId: number | null;
  camino: { id: number; nombre: string }[];
  avance: number;
  estado: EstadoProyecto;
  avanceEsperado: number;
  diasAtraso: number;
  serie: PuntoSerie[];
  vigencia: {
    supervisor: Vigencia;
    apoyo: Vigencia;
    encargado: Vigencia;
  };
}

export interface Asistente {
  id: number;
  fichaPersonalId: number | null;
  nombreCompleto: string;
  documento: string;
  grupoNombre: string;
}

export interface Jornada {
  id: number;
  fecha: string;
  equiposEjecutados: number;
  equiposProgramados: number;
  contratistasProgramados: number;
  supervisorFichaId: number | null;
  supervisorNombre: string | null;
  apoyoFichaId: number | null;
  apoyoNombre: string | null;
  asistencias: Asistente[];
  produccion: number | null;
  avanceAcumulado: number;
  contratistasTrabajando: number;
  calificacionProveedor: number | null;
}

export interface ContenidoCarpeta {
  carpeta: CarpetaObra | null;
  camino: { id: number; nombre: string }[];
  carpetas: CarpetaObra[];
  proyectos: ProyectoTarjeta[];
}

/** Persona elegible, del periodo que cubre una fecha. */
export interface PersonaElegible {
  id: number;
  nombreCompleto: string;
  documento: string;
  grupoId: number;
  grupoNombre: string;
}

export interface EmpresaElegible {
  id: number;
  nombre: string;
  personas: number;
}

export interface EmpresaParticipante {
  empresa: string;
  esEncargada: boolean;
  participaciones: number;
  personal: number;
  detalle: {
    documento: string;
    nombre: string;
    dias: number;
    fechas: string[];
  }[];
}

export interface Participacion {
  personas: {
    documento: string;
    fichaPersonalId: number | null;
    nombre: string;
    empresa: string;
    dias: number;
    fechas: string[];
  }[];
  empresas: string[];
  maximoDias: number;
}

export interface CalendarioPersona {
  documento: string;
  nombre: string;
  empresa: string;
  diasParticipados: number;
  diasDelProyecto: number;
  dias: { fecha: string; participo: boolean }[];
}

export interface GuardarProyectoPayload {
  nombre: string;
  carpetaId: number | null;
  sede: string;
  fechaInicio: string;
  fechaFinPrevista: string;
  totalEquipos: number;
  encargadoGrupoId: number;
  supervisorFichaId: number;
  apoyoFichaId: number | null;
}

export interface GuardarJornadaPayload {
  fecha: string;
  equiposEjecutados: number;
  equiposProgramados: number;
  contratistasProgramados: number;
  supervisorFichaId?: number | null;
  apoyoFichaId?: number | null;
  participantes: number[];
}
