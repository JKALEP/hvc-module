import { api } from '@/shared/services/api';
import { descargarArchivo } from '@/shared/services/descarga';
import type {
  Organizacion,
  NodoEstructura,
  DefinicionCampo,
  OpcionCampo,
  TipoCampo,
  ListadoEquipos,
  EquipoDetalle,
  EventoHistorial,
  ValoresEquipo,
  Incidencia,
  EstadoIncidencia,
  GuardarIncidenciaPayload,
  TipoDocumento,
  Cotizacion,
  OrdenCompra,
  GuardarDocumentoPayload,
  ResumenEquipos,
  DimensionReporte,
  Distribucion,
  FichaEquipo,
} from '@/modules/equipos/types';

const RAIZ = '/equipos';

// ── Organizaciones ──

export async function listarOrganizaciones() {
  const { data } = await api.get<Organizacion[]>(`${RAIZ}/organizacion`);
  return data;
}

export async function crearOrganizacion(nombre: string) {
  const { data } = await api.post<Organizacion>(`${RAIZ}/organizacion`, {
    nombre,
  });
  return data;
}

export async function editarOrganizacion(
  id: number,
  cambios: { nombre?: string; activo?: boolean },
) {
  const { data } = await api.patch<Organizacion>(
    `${RAIZ}/organizacion/${id}`,
    cambios,
  );
  return data;
}

export async function eliminarOrganizacion(id: number) {
  const { data } = await api.delete(`${RAIZ}/organizacion/${id}`);
  return data as { ok: true; nombre: string };
}

// ── Estructura ──

export async function obtenerArbol(organizacionId: number) {
  const { data } = await api.get<NodoEstructura[]>(
    `${RAIZ}/organizacion/${organizacionId}/estructura`,
  );
  return data;
}

export async function crearNodo(payload: {
  organizacionId: number;
  nombre: string;
  padreId: number | null;
}) {
  const { data } = await api.post<NodoEstructura>(`${RAIZ}/nodo`, payload);
  return data;
}

export async function renombrarNodo(id: number, nombre: string) {
  const { data } = await api.patch<NodoEstructura>(`${RAIZ}/nodo/${id}`, {
    nombre,
  });
  return data;
}

export async function eliminarNodo(id: number) {
  const { data } = await api.delete(`${RAIZ}/nodo/${id}`);
  return data as { ok: true; nombre: string };
}

// ── Campos dinámicos ──

export async function listarCampos(organizacionId: number) {
  const { data } = await api.get<DefinicionCampo[]>(
    `${RAIZ}/organizacion/${organizacionId}/campo`,
  );
  return data;
}

export async function crearCampo(payload: {
  organizacionId: number;
  nombre: string;
  tipo: TipoCampo;
  obligatorio: boolean;
  opciones?: string[];
}) {
  const { data } = await api.post<DefinicionCampo>(`${RAIZ}/campo`, payload);
  return data;
}

export async function editarCampo(
  id: number,
  cambios: {
    nombre?: string;
    obligatorio?: boolean;
    activo?: boolean;
    orden?: number;
  },
) {
  const { data } = await api.patch<DefinicionCampo>(
    `${RAIZ}/campo/${id}`,
    cambios,
  );
  return data;
}

export async function eliminarCampo(id: number) {
  const { data } = await api.delete(`${RAIZ}/campo/${id}`);
  return data as { ok: true; nombre: string };
}

export async function agregarOpcion(campoId: number, etiqueta: string) {
  const { data } = await api.post(`${RAIZ}/campo/${campoId}/opcion`, {
    etiqueta,
  });
  return data as OpcionCampo;
}

export async function eliminarOpcion(id: number) {
  const { data } = await api.delete(`${RAIZ}/opcion/${id}`);
  return data as { ok: true; etiqueta: string };
}

// ── Inventario ──

export async function listarEquipos(
  organizacionId: number,
  filtros: {
    nodoId?: number | null;
    q?: string;
    campos?: Record<string, string>;
    pagina?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (filtros.nodoId) params.set('nodoId', String(filtros.nodoId));
  if (filtros.q) params.set('q', filtros.q);
  if (filtros.pagina) params.set('pagina', String(filtros.pagina));
  // Los filtros dinámicos viajan como `campo.<clave>=<valor>`: así el
  // número de filtros no lo fija la firma del endpoint.
  for (const [clave, valor] of Object.entries(filtros.campos ?? {}))
    if (valor) params.set(`campo.${clave}`, valor);

  const { data } = await api.get<ListadoEquipos>(
    `${RAIZ}/organizacion/${organizacionId}/equipo?${params}`,
  );
  return data;
}

export async function obtenerEquipo(id: number) {
  const { data } = await api.get<EquipoDetalle>(`${RAIZ}/equipo/${id}`);
  return data;
}

export async function crearEquipo(payload: {
  organizacionId: number;
  nodoId: number;
  codigoInterno: string | null;
  valores: ValoresEquipo;
}) {
  const { data } = await api.post<{ id: number }>(`${RAIZ}/equipo`, payload);
  return data;
}

export async function editarEquipo(
  id: number,
  cambios: {
    nodoId?: number;
    codigoInterno?: string | null;
    valores?: ValoresEquipo;
  },
) {
  const { data } = await api.patch<EquipoDetalle>(
    `${RAIZ}/equipo/${id}`,
    cambios,
  );
  return data;
}

export async function eliminarEquipo(id: number) {
  const { data } = await api.delete(`${RAIZ}/equipo/${id}`);
  return data as { ok: true; codigoInterno: string | null };
}

export async function historialEquipo(id: number) {
  const { data } = await api.get<EventoHistorial[]>(
    `${RAIZ}/equipo/${id}/historial`,
  );
  return data;
}

// ── Incidencias ──

export async function listarIncidencias(
  organizacionId: number,
  filtros: { estado?: string; equipoId?: number | null; q?: string } = {},
) {
  const params = new URLSearchParams();
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.equipoId) params.set('equipoId', String(filtros.equipoId));
  if (filtros.q) params.set('q', filtros.q);

  const { data } = await api.get<Incidencia[]>(
    `${RAIZ}/organizacion/${organizacionId}/incidencia?${params}`,
  );
  return data;
}

export async function crearIncidencia(payload: GuardarIncidenciaPayload) {
  const { data } = await api.post<Incidencia>(`${RAIZ}/incidencia`, payload);
  return data;
}

export async function editarIncidencia(
  id: number,
  cambios: Partial<GuardarIncidenciaPayload> & { estado?: EstadoIncidencia },
) {
  const { data } = await api.patch<Incidencia>(
    `${RAIZ}/incidencia/${id}`,
    cambios,
  );
  return data;
}

export async function eliminarIncidencia(id: number) {
  const { data } = await api.delete(`${RAIZ}/incidencia/${id}`);
  return data as { ok: true; codigo: string };
}

export async function historialIncidencia(id: number) {
  const { data } = await api.get<EventoHistorial[]>(
    `${RAIZ}/incidencia/${id}/historial`,
  );
  return data;
}

// ── Cotizaciones y órdenes de compra ──
// Los dos comparten forma, así que el `tipo` decide la ruta.

export async function listarDocumentos(
  organizacionId: number,
  tipo: TipoDocumento,
  filtros: { estado?: string; q?: string } = {},
) {
  const params = new URLSearchParams();
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.q) params.set('q', filtros.q);
  const { data } = await api.get<(Cotizacion | OrdenCompra)[]>(
    `${RAIZ}/organizacion/${organizacionId}/${tipo}?${params}`,
  );
  return data;
}

export async function obtenerDocumento(tipo: TipoDocumento, id: number) {
  const { data } = await api.get<Cotizacion | OrdenCompra>(
    `${RAIZ}/${tipo}/${id}`,
  );
  return data;
}

export async function crearDocumento(
  tipo: TipoDocumento,
  payload: GuardarDocumentoPayload,
) {
  const { data } = await api.post<{ id: number }>(`${RAIZ}/${tipo}`, payload);
  return data;
}

export async function editarDocumento(
  tipo: TipoDocumento,
  id: number,
  cambios: Partial<GuardarDocumentoPayload> & { estado?: string },
) {
  const { data } = await api.patch(`${RAIZ}/${tipo}/${id}`, cambios);
  return data as Cotizacion | OrdenCompra;
}

export async function eliminarDocumento(tipo: TipoDocumento, id: number) {
  const { data } = await api.delete(`${RAIZ}/${tipo}/${id}`);
  return data as { ok: true; codigo: string };
}

/** Copia una cotización a una orden de compra nueva y editable. */
export async function ordenDesdeCotizacion(cotizacionId: number) {
  const { data } = await api.post<{ id: number }>(
    `${RAIZ}/cotizacion/${cotizacionId}/orden-compra`,
  );
  return data;
}

/** Descarga el Excel o el PDF del documento. Se genera al pedirlo. */
export function exportarDocumento(
  tipo: TipoDocumento,
  id: number,
  formato: 'excel' | 'pdf',
) {
  return descargarArchivo(
    `${RAIZ}/${tipo}/${id}/exportar?formato=${formato}`,
    `documento.${formato === 'excel' ? 'xlsx' : 'pdf'}`,
  );
}

// ── Reportes ──

/** Sin organización = consolidado global. */
function conOrganizacion(organizacionId: number | null, extra = '') {
  const params = new URLSearchParams(extra);
  if (organizacionId !== null)
    params.set('organizacionId', String(organizacionId));
  return params.toString();
}

export async function resumenEquipos(organizacionId: number | null) {
  const { data } = await api.get<ResumenEquipos>(
    `${RAIZ}/reporte/resumen?${conOrganizacion(organizacionId)}`,
  );
  return data;
}

export async function dimensionesReporte(organizacionId: number | null) {
  const { data } = await api.get<DimensionReporte[]>(
    `${RAIZ}/reporte/dimensiones?${conOrganizacion(organizacionId)}`,
  );
  return data;
}

export async function distribucionEquipos(
  organizacionId: number | null,
  dimension: string,
) {
  const { data } = await api.get<Distribucion>(
    `${RAIZ}/reporte/distribucion?${conOrganizacion(organizacionId, `dimension=${dimension}`)}`,
  );
  return data;
}

export function exportarDistribucion(
  organizacionId: number | null,
  dimension: string,
  formato: 'excel' | 'pdf',
) {
  return descargarArchivo(
    `${RAIZ}/reporte/distribucion/exportar?${conOrganizacion(organizacionId, `dimension=${dimension}&formato=${formato}`)}`,
    `distribucion.${formato === 'excel' ? 'xlsx' : 'pdf'}`,
  );
}

export async function fichaEquipo(equipoId: number) {
  const { data } = await api.get<FichaEquipo>(
    `${RAIZ}/reporte/equipo/${equipoId}`,
  );
  return data;
}

export function exportarFicha(equipoId: number, formato: 'excel' | 'pdf') {
  return descargarArchivo(
    `${RAIZ}/reporte/equipo/${equipoId}/exportar?formato=${formato}`,
    `ficha.${formato === 'excel' ? 'xlsx' : 'pdf'}`,
  );
}
