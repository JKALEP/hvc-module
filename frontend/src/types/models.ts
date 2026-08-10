// Modelos del dominio HVC Costos. Reflejan las respuestas del backend.
// Nota: los campos Decimal de Prisma (cantidad, precioUnitario) llegan como string en JSON.

export type Estado = 'COMPLETO' | 'INCOMPLETO';

export interface Producto {
  id: number;
  importacionId: number;
  codigo: string | null;
  descripcion: string;
  unidadMedida: string | null;
  cantidad: string | null;
  detalles: string | null;
  referencias: string | null;
  precioUnitario: string | null;
  proveedor: string | null;
  ruc: string | null;
  estado: Estado;
  creadoEn: string;
  actualizadoEn: string;
}

export interface Importacion {
  id: number;
  nombreArchivo: string;
  fechaImportacion: string;
  totalFilas: number;
  filasCompletas: number;
  estado: Estado;
}

// El detalle incluye las filas.
export interface ImportacionConProductos extends Importacion {
  productos: Producto[];
}

export interface HistorialPrecio {
  id: number;
  productoId: number;
  precioAnterior: string | null;
  precioNuevo: string;
  fecha: string;
}

// ─────────────────────────────────────────────────────────────
// MÓDULO PERSONAL Y PROYECTOS
// Los Decimal de Prisma (produccion, porcentaje…) llegan como string.
// ─────────────────────────────────────────────────────────────

export type EstadoActivo = 'ACTIVO' | 'INACTIVO';
export type EstadoProyecto = 'EN_EJECUCION' | 'FINALIZADO' | 'PAUSADO';

export interface EmpresaContratista {
  id: number;
  nombre: string;
  ruc: string;
  estado: EstadoActivo;
  _count?: { trabajadores: number };
}

export interface Trabajador {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  empresaId: number;
  estado: EstadoActivo;
  empresa?: { id: number; nombre: string; ruc: string };
}

export interface Supervisor {
  id: number;
  nombre: string;
  estado: EstadoActivo;
  _count?: { reportes: number };
}

/**
 * Override manual y EXCEPCIONAL del avance calculado. Solo aplica cuando
 * el avance real incluye trabajo no medible en equipos (planos, permisos).
 */
export interface AjusteAvance {
  id: number;
  proyectoId: number;
  porcentaje: string; // Decimal de Prisma → string
  fecha: string;
  observacion: string | null;
}

export interface Proyecto {
  id: number;
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  estado: EstadoProyecto;
  ajustes?: AjusteAvance[];
  _count?: { reportes: number; participaciones?: number };
}

export interface Participacion {
  id: number;
  reporteId: number;
  trabajadorId: number;
  empresaId: number;
  proyectoId: number;
  fecha: string;
  trabajador: Pick<Trabajador, 'id' | 'dni' | 'nombres' | 'apellidos'>;
  empresa: { id: number; nombre: string; ruc: string };
}

export interface ReporteDiario {
  id: number;
  fecha: string;
  proyectoId: number;
  supervisorId: number;
  equiposProgramados: number;
  equiposEjecutados: number;
  tecnicosProgramados: number;
  // Manual: expectativa de cuántas contratistas trabajarían ese día.
  numeroContratistasProgramados: number | null;
  // Calculados por el backend, nunca se envían.
  produccion: string | null;
  tecnicosLaborando: number;
  numeroContratistasTrabajando: number;
  // Cualitativas e independientes entre sí.
  calificacionProveedor: string | null; // evalúa a la contratista
  calificacionSupervisor: string | null; // evalúa al supervisor de HVC
  proyecto: { id: number; nombre: string };
  supervisor: { id: number; nombre: string };
  _count?: { participaciones: number };
}

// El detalle trae las participaciones con trabajador y empresa.
export interface ReporteDiarioDetalle extends ReporteDiario {
  participaciones: Participacion[];
}

// Lo que se envía al crear/editar un reporte. produccion y
// tecnicosLaborando NO van: los calcula el backend.
export interface GuardarReportePayload {
  fecha: string;
  proyectoId: number;
  supervisorId: number;
  equiposProgramados: number;
  equiposEjecutados: number;
  tecnicosProgramados: number;
  numeroContratistasProgramados: number | null;
  calificacionProveedor: number | null;
  calificacionSupervisor: number | null;
  trabajadoresIds: number[];
}

// ── Indicadores de personal ──

export interface KpisPersonal {
  personalContratado: number;
  personalQueParticipo: number;
  personalSinParticipacion: number;
  participacionesRegistradas: number;
  diasConReporte: number;
  utilizacionCobertura: number | null;
  utilizacionIntensidad: number | null;
  capacidadDiasPersona: number;
  promedioParticipacion: number | null;
}

export interface FilaRanking {
  trabajadorId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  empresaId: number;
  empresa: string | null;
  enPlanilla: boolean;
  diasTrabajados: number;
  // Días con reporte de los proyectos donde participó: es su denominador.
  diasBase: number;
  porcentajeParticipacion: number | null;
  proyectos: { id: number; nombre: string }[];
}

export interface FilaMenorParticipacion {
  trabajadorId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  empresaId: number;
  empresa: string | null;
  diasTrabajados: number;
  diasConReporte: number;
  porcentajeSobreRango: number | null;
}

export interface FilaEmpresa {
  empresaId: number;
  empresa: string;
  ruc: string;
  contratados: number;
  participaron: number;
  sinParticipacion: number;
  participaciones: number;
  // ¿Qué parte de su planilla se usó al menos un día?
  utilizacionCobertura: number | null;
  // ¿Qué parte de la capacidad del RANGO se usó?
  utilizacionIntensidad: number | null;
  // ¿Qué parte de la capacidad REALMENTE DISPONIBLE se usó? Denominador =
  // contratados × días activos de sus propias obras. Es la única que
  // compara de igual a igual una obra larga contra una corta.
  utilizacionEfectiva: number | null;
  diasExposicion: number;
  capacidadExpuesta: number;
  proyectos: { id: number; nombre: string }[];
}

export interface IndicadoresPersonal {
  rango: { desde: string | null; hasta: string | null; diasConReporte: number };
  kpis: KpisPersonal;
  ranking: FilaRanking[];
  menorParticipacion: FilaMenorParticipacion[];
  porEmpresa: FilaEmpresa[];
}

export interface FiltrosPersonal {
  desde: string;
  hasta: string;
  empresaId: number | null;
  proyectoId: number | null;
}

// ── Avance de proyectos (Fase 3) ──

/** Rango de fechas compartido por las vistas de proyecto. */
export interface Periodo {
  desde: string;
  hasta: string;
}

export interface SupervisorReportante {
  id: number;
  nombre: string;
  reportes: number;
}

/**
 * Métricas agregadas de un proyecto sobre un período.
 * produccionPromedio y cumplimiento NO son lo mismo: la primera es la media
 * de los porcentajes diarios, la segunda es Σejecutados/Σprogramados.
 */
export interface MetricasProyecto {
  diasConReporte: number;
  equiposProgramados: number;
  equiposEjecutados: number;
  produccionPromedio: number | null;
  cumplimiento: number | null;
  tecnicosPromedioProgramados: number | null;
  tecnicosPromedioLaborando: number | null;
  contratistasPromedioTrabajando: number | null;
  contratistasPromedioProgramados: number | null;
}

/**
 * AVANCE TOTAL calculado: Σ ejecutados / Σ programados sobre TODO el
 * historial del proyecto. Nunca se filtra por período.
 */
export interface AvanceCalculado {
  porcentaje: number | null;
  equiposProgramados: number;
  equiposEjecutados: number;
  reportes: number;
  origen: 'CALCULADO';
}

/** Último override manual, con cuánto se aparta del cálculo. */
export interface AjusteManualResumen {
  id: number;
  porcentaje: number | null;
  fecha: string;
  observacion: string | null;
  desviacion: number | null;
}

export interface ResumenProyecto extends MetricasProyecto {
  proyecto: {
    id: number;
    nombre: string;
    cliente: string | null;
    ubicacion: string | null;
    estado: EstadoProyecto;
  };
  // Calculado sobre todo el historial. Es el número por defecto de la obra.
  avanceAcumulado: AvanceCalculado;
  // Excepción, siempre visible junto al calculado. Nunca lo reemplaza solo.
  ajusteManual: AjusteManualResumen | null;
  periodo: { desde: string | null; hasta: string | null };
  supervisores: SupervisorReportante[];
  personalDistinto: number;
  empresasDistintas: number;
  participaciones: number;
}

/** Un día de la serie de cumplimiento acumulado. */
export interface PuntoCumplimiento {
  fecha: string;
  equiposProgramados: number;
  equiposEjecutados: number;
  acumuladoProgramados: number;
  acumuladoEjecutados: number;
  // OJO: puede BAJAR. Es una razón corriente, no un progreso monótono.
  cumplimientoAcumulado: number | null;
}

export interface SerieCumplimiento {
  serie: PuntoCumplimiento[];
  ajustes: {
    id: number;
    fecha: string;
    porcentaje: number | null;
    observacion: string | null;
  }[];
  ajustesFueraDePeriodo: number;
  totalHistorico: number | null;
  recortadoPorPeriodo: boolean;
}

/** produccion es null si ese día no hubo equipos programados. */
export interface PuntoProduccion {
  fecha: string;
  produccion: number | null;
}

export interface PuntoEquipos {
  fecha: string;
  programados: number;
  ejecutados: number;
}

export interface PuntoTecnicos {
  fecha: string;
  programados: number;
  laborando: number;
  diferencia: number;
}

export interface FilaComparacion extends MetricasProyecto {
  id: number;
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  estado: EstadoProyecto;
  avanceAcumulado: number | null;
  personalDistinto: number;
  reportes: number;
}

/** Alta de un ajuste manual. La justificación es OBLIGATORIA. */
export interface GuardarAjustePayload {
  fecha: string;
  porcentaje: number;
  observacion: string;
}

// ── Alertas y cruce (pestaña de /personal y sección de /proyectos/:id) ──

export type Severidad = 'ALTA' | 'MEDIA' | 'BAJA';

export type TipoAlerta =
  | 'SIN_PARTICIPACION'
  | 'POCA_PARTICIPACION'
  | 'UTILIZACION_EMPRESA'
  | 'BRECHA_TECNICOS'
  | 'EXCEDENTE_TECNICOS'
  | 'PRODUCCION_PROYECTO';

export interface Umbrales {
  diasMinimos: number;
  diasConReporteMinimos: number;
  coberturaEmpresa: number;
  coberturaEmpresaCritica: number;
  produccionProyecto: number;
  produccionProyectoCritica: number;
  brechaTecnicosAlta: number;
  brechaTecnicosMedia: number;
}

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidad: Severidad;
  titulo: string;
  mensaje: string;
  valor: number | null;
  umbral: number | null;
  proyectoId?: number;
  trabajadorId?: number;
  empresaId?: number;
  reporteId?: number;
  fecha?: string;
}

export interface ReglaOmitida {
  tipo: string;
  motivo: string;
}

export interface RespuestaAlertas {
  periodo: { desde: string | null; hasta: string | null; diasConReporte: number };
  reglasOmitidas: ReglaOmitida[];
  total: number;
  conteo: Record<Severidad, number>;
  alertas: Alerta[];
  umbrales: Umbrales;
}

export interface FilaCruce {
  trabajadorId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  diasTrabajados: number;
  diasDelProyecto: number;
  porcentajeParticipacion: number | null;
  empresaId: number;
  empresa: string;
  ruc: string;
  // Utilización de la contratista en TODO el período, no solo en este proyecto.
  empresaUtilizacionCobertura: number | null;
  empresaUtilizacionIntensidad: number | null;
  empresaContratados: number | null;
}

export interface EmpresaEnProyecto {
  empresaId: number;
  empresa: string;
  ruc: string;
  personasEnProyecto: number;
  participacionesEnProyecto: number;
  utilizacionCobertura: number | null;
  utilizacionIntensidad: number | null;
  contratados: number | null;
}

export interface CruceProyecto {
  proyecto: {
    id: number;
    nombre: string;
    cliente: string | null;
    ubicacion: string | null;
    estado: EstadoProyecto;
  };
  avanceAcumulado: AvanceCalculado;
  periodo: { desde: string | null; hasta: string | null; diasConReporte: number };
  produccionPromedio: number | null;
  cumplimiento: number | null;
  personal: FilaCruce[];
  empresas: EmpresaEnProyecto[];
  umbrales: Umbrales;
}


// Campos que se pueden editar de una fila (todos opcionales).
export interface EditarProductoPayload {
  codigo?: string | null;
  descripcion?: string | null;
  unidadMedida?: string | null;
  cantidad?: string | null;
  detalles?: string | null;
  referencias?: string | null;
  precioUnitario?: string | null;
  proveedor?: string | null;
  ruc?: string | null;
}

// ── Vista mensual (conmutador Fechas | Meses) ──

export interface MesEje {
  anio: number;
  mes: number;
  clave: string; // "2026-01"
  etiqueta: string; // "Ene 2026"
}

/** De dónde salió el headcount de un mes. */
export type OrigenHeadcount = 'NOMINA_MENSUAL' | 'PLANILLA_VIGENTE';

export interface MesEmpresa {
  clave: string;
  etiqueta: string;
  contratados: number;
  participaron: number;
  sinParticipacion: number;
  participaciones: number;
  cobertura: number | null;
  intensidad: number | null;
  utilizacionEfectiva: number | null;
  diasExposicion: number;
  diasConReporte: number;
  origen: OrigenHeadcount;
}

export interface EmpresaMensual {
  empresaId: number;
  empresa: string;
  ruc: string;
  contratadosPromedio: number;
  trabajadoresDistintos: number;
  coberturaMedia: number | null;
  intensidadMedia: number | null;
  utilizacionEfectivaMedia: number | null;
  participacionesTotal: number;
  meses: MesEmpresa[];
}

export interface MesTrabajador {
  clave: string;
  etiqueta: string;
  dias: number;
  diasConReporte: number;
  porcentaje: number | null;
}

export interface TrabajadorMensual {
  trabajadorId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  estado: EstadoActivo | null;
  empresas: { empresaId: number; nombre: string }[];
  // Más de una empresa en el rango = pasó de contrata.
  cambioDeContrata: boolean;
  totalDias: number;
  porcentajeMedio: number | null;
  meses: MesTrabajador[];
}

export interface ExtremoMes {
  clave: string;
  etiqueta: string;
  valor: number;
}

export interface KpisMensual {
  contratadoPromedio: number;
  contratadosDistintos: number;
  participoPromedio: number;
  sinParticipacionPromedio: number;
  peorMesSinParticipacion: ExtremoMes | null;
  diasConReporteTotal: number;
  diasConReportePromedio: number;
  utilizacionCoberturaMedia: number | null;
  coberturaMin: ExtremoMes | null;
  coberturaMax: ExtremoMes | null;
  utilizacionIntensidadMedia: number | null;
  intensidadMin: ExtremoMes | null;
  intensidadMax: ExtremoMes | null;
  participacionesTotal: number;
}

export interface IndicadoresMensual {
  meses: MesEje[];
  esRango: boolean;
  kpis: KpisMensual;
  porEmpresa: EmpresaMensual[];
  ranking: TrabajadorMensual[];
  menorParticipacion: {
    trabajadorId: number;
    dni: string;
    nombres: string;
    apellidos: string;
    empresas: { empresaId: number; nombre: string }[];
    totalDias: number;
    mesesSinActividad: number;
    porcentajeMedio: number | null;
  }[];
  nomina: {
    hayNomina: boolean;
    mesesConNomina: string[];
    mesesSinNomina: string[];
  };
}

/** Detalle de una contratista, para la fila expandible. */
export interface EmpresaDetalleMensual {
  empresa: { id: number; nombre: string; ruc: string; estado: EstadoActivo };
  meses: MesEje[];
  hayNomina: boolean;
  trabajadores: {
    trabajadorId: number;
    dni: string;
    nombres: string;
    apellidos: string;
    estado: EstadoActivo | null;
    totalDias: number;
    porcentajeMedio: number | null;
    mesesSinActividad: number;
    meses: (MesTrabajador & { enPlanilla: boolean | null })[];
  }[];
}

/** Rango de meses del conmutador. */
export interface RangoMeses {
  desdeMes: string; // "YYYY-MM"
  hastaMes: string;
}

// ── Seguimiento de supervisores ──

export interface MetricasSupervisor {
  reportes: number;
  diasReportados: number;
  produccionPromedio: number | null;
  cumplimiento: number | null;
  equiposProgramados: number;
  equiposEjecutados: number;
  calificacionPromedio: number | null;
  calificacionesRegistradas: number;
  personalPromedioPorDia: number | null;
  jornadasConBrecha: number;
  porcentajeJornadasConBrecha: number | null;
}

export interface FilaSupervisor extends MetricasSupervisor {
  id: number;
  nombre: string;
  estado: EstadoActivo;
  proyectosHistoricos: number;
  proyectosEnPeriodo: number;
}

export interface ProyectoSupervisado extends MetricasSupervisor {
  proyectoId: number;
  nombre: string;
  cliente: string | null;
  estado: EstadoProyecto | null;
  primerReporte: string;
  ultimoReporte: string;
}

export interface ResumenSupervisor {
  supervisor: { id: number; nombre: string; estado: EstadoActivo };
  periodo: { desde: string | null; hasta: string | null };
  historico: MetricasSupervisor;
  proyectosSupervisados: ProyectoSupervisado[];
  totalProyectos: number;
  enPeriodo: MetricasSupervisor;
}

// ── Autenticación y permisos ──

/** CLIENTE es una cuenta externa: sin módulos, solo lo compartido. */
export type RolGlobal = 'SUPERADMIN' | 'ADMIN' | 'CLIENTE';
export type Modulo = 'COSTOS' | 'PERSONAL_PROYECTOS' | 'FOTOS';
export type NivelFotos = 'ADMIN_FOTOS' | 'COLABORADOR';
export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

export interface Permiso {
  id?: number;
  modulo: Modulo;
  /** Solo tiene valor cuando modulo === 'FOTOS'. */
  nivelFotos: NivelFotos | null;
}

/** Sesión vigente: lo que devuelve /auth/login y /auth/yo. */
export interface UsuarioSesion {
  id: number;
  email: string;
  nombre: string;
  rol: RolGlobal;
  permisos: Permiso[];
}

export interface RespuestaLogin {
  token: string;
  usuario: UsuarioSesion;
}

/** Fila de la gestión de cuentas (solo SuperAdmin). */
export interface UsuarioAdmin {
  id: number;
  email: string;
  nombre: string;
  rol: RolGlobal;
  estado: EstadoUsuario;
  ultimoAcceso: string | null;
  creadoEn: string;
  permisos: Permiso[];
}

export interface GuardarUsuarioPayload {
  email?: string;
  nombre?: string;
  password?: string;
  estado?: EstadoUsuario;
  permisos?: { modulo: Modulo; nivelFotos?: NivelFotos | null }[];
}

// ─────────────────────────────────────────────────────────────
// MÓDULO FOTOS
// ─────────────────────────────────────────────────────────────

export type EstadoSede = 'ACTIVA' | 'INACTIVA';
/** CERRADO = solo lectura para todos, incluido un ADMIN_FOTOS. */
export type EstadoAlbum = 'ABIERTO' | 'CERRADO';

/** Nodo del árbol de sedes, con sus hijas anidadas. */
export interface NodoSede {
  id: number;
  nombre: string;
  parentId: number | null;
  /** Ruta materializada: "1/4/9", ids separados por barra. */
  ruta: string;
  estado: EstadoSede;
  albumes: number;
  hijas: NodoSede[];
}

interface SedeDeAlbum {
  id: number;
  nombre: string;
  ruta: string;
}

export interface AlbumResumen {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: EstadoAlbum;
  creadoEn: string;
  sede: SedeDeAlbum;
  creadoPor: { id: number; nombre: string };
  _count: { fotos: number; compartidos: number };
  /** Portada: la última foto subida, ya firmada. */
  ultimaFoto: { id: number; creadoEn: string; urlMiniatura: string } | null;
}

export interface AlbumDetalle {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: EstadoAlbum;
  sedeId: number;
  creadoEn: string;
  sede: SedeDeAlbum;
  creadoPor: { id: number; nombre: string };
  _count: { fotos: number; compartidos: number };
}

export interface FotoFeed {
  id: number;
  descripcion: string | null;
  anchoPx: number;
  altoPx: number;
  bytes: number;
  /** Fecha de captura del EXIF, "YYYY-MM-DD". Puede no venir. */
  tomadaEn: string | null;
  creadoEn: string;
  /** null para un cliente externo: no se le enseña quién de HVC subió qué. */
  subidaPor: { id: number; nombre: string } | null;
  url: string;
  urlMiniatura: string;
}

export interface FeedAlbum {
  album: AlbumDetalle;
  /** false si el álbum está CERRADO. */
  puedeSubir: boolean;
  total: number;
  fotos: FotoFeed[];
}

export interface AutorFeed {
  usuarioId: number;
  nombre: string;
  fotos: number;
}

export interface FiltrosFeed {
  subidaPorId: number | null;
  desde: string;
  hasta: string;
}

export interface ResultadoSubida {
  subidas: number;
  fallidas: { archivo: string; motivo: string }[];
  bytesGuardados: number;
  bytesOriginales: number;
}

/** Una sede vista como carpeta en el explorador. */
export interface CarpetaSede {
  id: number;
  nombre: string;
  estado: EstadoSede;
  subsedes: number;
  /** Álbumes de todo el subárbol, no solo los colgados directamente. */
  albumes: number;
}

// ── Compartir ──

/** Qué se comparte. En la URL viaja con el lenguaje de la UI. */
export type TipoCompartible = 'carpeta' | 'album';

export interface AccesoCompartido {
  id: number;
  creadoEn: string;
  usuario: { id: number; nombre: string; email: string; rol: RolGlobal };
  otorgadoPor: { id: number; nombre: string };
  /** 'ver' para un cliente externo; 'ver-y-subir' para un interno. */
  puede: 'ver' | 'ver-y-subir';
}

export interface InvitacionPendiente {
  id: number;
  email: string;
  expiraEn: string;
  creadoEn: string;
  invitadoPor: { id: number; nombre: string };
  vencida: boolean;
}

export interface ListaCompartidos {
  accesos: AccesoCompartido[];
  invitaciones: InvitacionPendiente[];
}

/** Por qué camino se resolvió el "Compartir": lo decide el backend. */
export type ResultadoCompartir =
  | { via: 'acceso-directo'; nombre: string; email: string; rol: RolGlobal }
  | { via: 'invitacion'; email: string; expiraEn: string; enlace: string };

/** Lo que hay detrás de un enlace de invitación, antes de activar. */
export interface InvitacionAbierta {
  email: string;
  recurso: string;
  invitadoPor: string;
  expiraEn: string;
}

/** Contenido de una carpeta: lo que devuelve /fotos/navegacion. */
export interface ContenidoCarpeta {
  /** true para un colaborador en la raíz: ve álbumes sueltos, sin carpetas. */
  raizPlana: boolean;
  ancestros: { id: number; nombre: string }[];
  sedeActual: { id: number; nombre: string; estado: EstadoSede } | null;
  subsedes: CarpetaSede[];
  albumes: AlbumResumen[];
}
