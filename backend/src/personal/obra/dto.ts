// Interfaces planas, sin class-validator: la validación se hace a mano
// en `validacion.ts`, con mensajes en español.

// ── Carpeta ──

export interface CrearCarpetaDto {
  nombre?: string | null;
  parentId?: number | string | null;
}

export interface EditarCarpetaDto {
  nombre?: string | null;
  /** Mover. `null` explícito la lleva a la raíz. */
  parentId?: number | string | null;
}

// ── Proyecto ──

export interface CrearProyectoDto {
  nombre?: string | null;
  carpetaId?: number | string | null;
  sede?: string | null;
  fechaInicio?: string | null;
  fechaFinPrevista?: string | null;
  totalEquipos?: number | string | null;
  /** Id de un GrupoPersonal de tipo CONTRATISTA. */
  encargadoGrupoId?: number | string | null;
  /** Id de una FichaPersonal de un periodo SUPERVISOR. */
  supervisorFichaId?: number | string | null;
  apoyoFichaId?: number | string | null;
}

export type EditarProyectoDto = Partial<CrearProyectoDto>;

// ── Jornada ──

/** Una persona registrada como participante de un día. */
export interface ParticipanteDto {
  fichaPersonalId?: number | string | null;
}

export interface GuardarJornadaDto {
  fecha?: string | null;
  equiposEjecutados?: number | string | null;
  equiposProgramados?: number | string | null;
  contratistasProgramados?: number | string | null;
  supervisorFichaId?: number | string | null;
  apoyoFichaId?: number | string | null;
  /** Sustituye la lista completa del día. */
  participantes?: unknown;
}

export type EditarJornadaDto = Partial<GuardarJornadaDto>;

// ── Formas devueltas ──

/** Los tres estados posibles. Se derivan del avance, nunca se guardan. */
export type EstadoProyecto = 'INICIO' | 'EN_PROCESO' | 'FINALIZADO';

/**
 * Si una asignación fija sigue figurando en el periodo de personal
 * vigente. Se calcula en lectura comparando el documento (o el nombre
 * del grupo) guardado como snapshot.
 */
export interface Vigencia {
  vigente: boolean;
  /** Qué periodo se usó para comprobarlo, para poder explicarlo en la UI. */
  periodo: { anio: number; mes: number } | null;
}
