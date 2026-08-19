// Gestión de equipos — Fase 1: organizaciones y su estructura.

export interface Organizacion {
  id: number;
  nombre: string;
  /** Visibilidad, NO borrado lógico: una organización inactiva sigue
   *  teniendo sus equipos y su historial, solo deja de ofrecerse. */
  activo: boolean;
  actualizadoEn: string;
  nodos: number;
  equipos: number;
  campos: number;
}

/** Un nodo del árbol de ubicaciones, con sus hijos dentro. */
export interface NodoEstructura {
  id: number;
  nombre: string;
  orden: number;
  padreId: number | null;
  equipos: number;
  hijos: NodoEstructura[];
}

// ── Fase 2: campos dinámicos e inventario ──

export type TipoCampo =
  | 'TEXTO'
  | 'TEXTO_LARGO'
  | 'NUMERO_ENTERO'
  | 'NUMERO_DECIMAL'
  | 'MONEDA'
  | 'FECHA'
  | 'FECHA_HORA'
  | 'BOOLEANO'
  | 'LISTA'
  | 'SELECCION_MULTIPLE'
  | 'ARCHIVO'
  | 'IMAGEN'
  | 'CORREO'
  | 'TELEFONO'
  | 'URL';

export interface OpcionCampo {
  id: number;
  etiqueta: string;
  orden: number;
  activo: boolean;
}

export interface DefinicionCampo {
  id: number;
  organizacionId: number;
  nombre: string;
  /** Slug estable. NO cambia al renombrar el campo. */
  clave: string;
  tipo: TipoCampo;
  obligatorio: boolean;
  orden: number;
  /** Visibilidad, no borrado: apagarlo conserva lo capturado. */
  activo: boolean;
  opciones: OpcionCampo[];
  _count: { valores: number };
}

/** Una columna de la tabla de inventario. */
export interface ColumnaInventario {
  clave: string;
  nombre: string;
  tipo: TipoCampo;
}

/** Una fila: los valores ya aplanados por clave. */
export interface EquipoFila {
  id: number;
  codigoInterno: string | null;
  nodo: { id: number; nombre: string };
  actualizadoEn: string;
  valores: Record<string, string>;
}

export interface ListadoEquipos {
  total: number;
  pagina: number;
  porPagina: number;
  columnas: ColumnaInventario[];
  equipos: EquipoFila[];
}

/** Un valor en la ficha, con la forma que devuelve el backend. */
export interface ValorFicha {
  campo: {
    id: number;
    nombre: string;
    clave: string;
    tipo: TipoCampo;
    orden: number;
  };
  valorTexto: string | null;
  valorNumero: string | null;
  valorEntero: number | null;
  valorFecha: string | null;
  valorBooleano: boolean | null;
  claveArchivo: string | null;
  opcion: { id: number; etiqueta: string } | null;
  opciones: { id: number; etiqueta: string }[];
}

export interface EquipoDetalle {
  id: number;
  codigoInterno: string | null;
  organizacion: { id: number; nombre: string };
  nodo: { id: number; nombre: string };
  creadoPor: { id: number; nombre: string } | null;
  creadoEn: string;
  actualizadoEn: string;
  valores: ValorFicha[];
  _count: { incidencias: number; fotos: number };
}

export interface EventoHistorial {
  id: number;
  tipo: string;
  campoAfectado: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  descripcion: string | null;
  creadoEn: string;
  usuario: { id: number; nombre: string } | null;
}

/** Lo que el formulario dinámico manda: indexado por CLAVE. */
export type ValoresEquipo = Record<string, unknown>;

// ── Fase 3: incidencias ──

export type EstadoIncidencia = 'ABIERTA' | 'EN_ATENCION' | 'CERRADA';

export interface Incidencia {
  id: number;
  /** Correlativo legible: INC-2026-001. */
  codigo: string;
  equipoId: number;
  /** Texto libre: cada organización tiene su vocabulario. */
  tipo: string;
  prioridad: string | null;
  descripcion: string;
  observacion: string | null;
  recomendacion: string | null;
  estado: EstadoIncidencia;
  fechaCierre: string | null;
  creadoEn: string;
  equipo: {
    id: number;
    codigoInterno: string | null;
    nodo: { id?: number; nombre: string };
  };
  responsable: { id: number; nombre: string } | null;
  creadoPor?: { id: number; nombre: string } | null;
  _count: { fotos: number; cotizaciones: number; ordenesCompra: number };
}

export interface GuardarIncidenciaPayload {
  equipoId: number;
  tipo: string;
  prioridad: string | null;
  descripcion: string;
  observacion: string | null;
  recomendacion: string | null;
  responsableId: number | null;
}

// ── Fase 4: cotizaciones y órdenes de compra ──

export type EstadoCotizacion = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export type EstadoOrdenCompra =
  'EMITIDA' | 'EN_PROCESO' | 'ATENDIDA' | 'CANCELADA';

/** Cuál de los dos documentos. Define endpoints, estados y etiquetas. */
export type TipoDocumento = 'cotizacion' | 'orden-compra';

/** Una línea ya guardada, con su subtotal calculado por el backend. */
export interface LineaDocumento {
  id: number;
  orden: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  /** cantidad × precioUnitario. Calculado, nunca guardado. */
  subtotal: number;
}

/** Una línea mientras se edita: texto libre hasta que se guarda. */
export interface LineaBorrador {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

interface DocumentoBase {
  id: number;
  codigo: string;
  organizacionId: number;
  proveedor: string;
  creadoEn: string;
  organizacion: { id: number; nombre: string };
  equipo: { id: number; codigoInterno: string | null } | null;
  incidencia: { id: number; codigo: string; tipo: string } | null;
  creadoPor: { id: number; nombre: string } | null;
  lineas: LineaDocumento[];
  /** Suma de los subtotales. Calculado, nunca guardado. */
  total: number;
}

export interface Cotizacion extends DocumentoBase {
  estado: EstadoCotizacion;
  _count: { ordenesCompra: number };
}

export interface OrdenCompra extends DocumentoBase {
  estado: EstadoOrdenCompra;
  cotizacionId: number | null;
  cotizacion: { id: number; codigo: string } | null;
}

/** Lo que se manda al guardar cualquiera de los dos. */
export interface GuardarDocumentoPayload {
  organizacionId: number;
  proveedor: string;
  equipoId: number | null;
  incidenciaId: number | null;
  lineas: LineaBorrador[];
}

// ── Reportes ──

/** Una dimensión por la que repartir el inventario. */
export interface DimensionReporte {
  /** `organizacion`, `nodo`, o `campo-<id>`. */
  clave: string;
  etiqueta: string;
  requiereOrganizacion: boolean;
}

export interface FilaDistribucion {
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
}

export interface Distribucion {
  dimension: string;
  etiqueta: string;
  total: number;
  /** Selección múltiple: un equipo puede caer en varias filas. */
  multiple: boolean;
  filas: FilaDistribucion[];
}

export interface ResumenEquipos {
  equipos: number;
  organizaciones: number;
  nodos: number;
  incidenciasAbiertas: number;
  cotizacionesPendientes: number;
  ordenesActivas: number;
}

/** Una sección de la ficha: ya viene en texto desde el backend. */
export interface SeccionFicha {
  titulo: string;
  columnas: string[];
  filas: string[][];
  vacio: string;
}

export interface FichaEquipo {
  equipo: {
    id: number;
    codigoInterno: string | null;
    organizacion: { id: number; nombre: string };
    /** El camino completo del árbol, ya unido. */
    ubicacion: string;
    nodo: { id: number; nombre: string };
    creadoPor: string | null;
    creadoEn: string;
    actualizadoEn: string;
    fotos: number;
  };
  secciones: SeccionFicha[];
}
