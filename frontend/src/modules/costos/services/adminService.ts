import { api } from '@/shared/services/api';
import type {
  ClienteCostosCompleto,
  CrearVersionPayload,
  EventoCostos,
  EntidadCostos,
  GuardarOpcionPayload,
  OpcionCatalogoCompleta,
  PlantillaCorreo,
  PrevisualizacionPlantilla,
  ResultadoEliminar,
  SupervisorCompleto,
  TipoCatalogo,
  VersionPlantilla,
} from '@/modules/costos/types';

// Los maestros del módulo y la bitácora (§58, §64), todo bajo SuperAdmin.
//
// Un archivo porque es UN controller en el backend (`CatalogoController`
// más la ruta de auditoría, las dos bajo `costos/admin`) y una sola
// pantalla en §59. Los proveedores NO están aquí: tienen controller
// propio y los toca también el Gestor, así que viven en
// `proveedorService`.

const RAIZ = '/costos/admin';

// ── Catálogos (§58) ──

/**
 * Un catálogo entero, o los tres si no se acota.
 *
 * Sin `soloActivas`: la pantalla de administración quiere ver también
 * las retiradas —son justo las que a veces hay que reactivar—. El
 * selector del formulario sí las filtra, pero eso lo pide por otra ruta.
 */
export async function listarOpciones(
  tipo?: TipoCatalogo,
): Promise<OpcionCatalogoCompleta[]> {
  const { data } = await api.get<OpcionCatalogoCompleta[]>(`${RAIZ}/catalogo`, {
    params: tipo ? { tipo } : {},
  });
  return data;
}

export async function crearOpcion(
  payload: GuardarOpcionPayload,
): Promise<OpcionCatalogoCompleta> {
  const { data } = await api.post<OpcionCatalogoCompleta>(
    `${RAIZ}/catalogo`,
    payload,
  );
  return data;
}

export async function editarOpcion(
  id: number,
  payload: Omit<GuardarOpcionPayload, 'tipo'>,
): Promise<OpcionCatalogoCompleta> {
  const { data } = await api.patch<OpcionCatalogoCompleta>(
    `${RAIZ}/catalogo/${id}`,
    payload,
  );
  return data;
}

export async function eliminarOpcion(id: number): Promise<ResultadoEliminar> {
  const { data } = await api.delete<ResultadoEliminar>(
    `${RAIZ}/catalogo/${id}`,
  );
  return data;
}

// ── Clientes (§13) ──

export async function listarClientes(
  q: string,
): Promise<ClienteCostosCompleto[]> {
  const { data } = await api.get<ClienteCostosCompleto[]>(`${RAIZ}/cliente`, {
    params: q ? { q } : {},
  });
  return data;
}

export async function crearCliente(
  payload: Partial<ClienteCostosCompleto>,
): Promise<ClienteCostosCompleto> {
  const { data } = await api.post<ClienteCostosCompleto>(
    `${RAIZ}/cliente`,
    payload,
  );
  return data;
}

export async function editarCliente(
  id: number,
  payload: Partial<ClienteCostosCompleto>,
): Promise<ClienteCostosCompleto> {
  const { data } = await api.patch<ClienteCostosCompleto>(
    `${RAIZ}/cliente/${id}`,
    payload,
  );
  return data;
}

export async function eliminarCliente(id: number): Promise<ResultadoEliminar> {
  const { data } = await api.delete<ResultadoEliminar>(`${RAIZ}/cliente/${id}`);
  return data;
}

// ── Supervisores (§13) ──

export async function listarSupervisores(
  q: string,
): Promise<SupervisorCompleto[]> {
  const { data } = await api.get<SupervisorCompleto[]>(`${RAIZ}/supervisor`, {
    params: q ? { q } : {},
  });
  return data;
}

export async function crearSupervisor(
  payload: Partial<SupervisorCompleto>,
): Promise<SupervisorCompleto> {
  const { data } = await api.post<SupervisorCompleto>(
    `${RAIZ}/supervisor`,
    payload,
  );
  return data;
}

export async function editarSupervisor(
  id: number,
  payload: Partial<SupervisorCompleto>,
): Promise<SupervisorCompleto> {
  const { data } = await api.patch<SupervisorCompleto>(
    `${RAIZ}/supervisor/${id}`,
    payload,
  );
  return data;
}

export async function eliminarSupervisor(
  id: number,
): Promise<ResultadoEliminar> {
  const { data } = await api.delete<ResultadoEliminar>(
    `${RAIZ}/supervisor/${id}`,
  );
  return data;
}

// ── Plantillas de correo (§32, §68) ──

export async function obtenerPlantilla(): Promise<PlantillaCorreo> {
  const { data } = await api.get<PlantillaCorreo>(`${RAIZ}/plantilla`);
  return data;
}

/** Publicar es crear otra versión: no existe «editar» (§68). */
export async function crearVersionPlantilla(
  payload: CrearVersionPayload,
): Promise<VersionPlantilla> {
  const { data } = await api.post<VersionPlantilla>(
    `${RAIZ}/plantilla/version`,
    payload,
  );
  return data;
}

/** Vuelve a una versión anterior sin reescribir nada. */
export async function activarVersionPlantilla(
  versionId: number,
): Promise<VersionPlantilla> {
  const { data } = await api.post<VersionPlantilla>(
    `${RAIZ}/plantilla/version/${versionId}/activar`,
  );
  return data;
}

/** Cómo quedaría, con datos de ejemplo. No manda nada. */
export async function previsualizarPlantilla(payload: {
  asunto: string;
  cuerpo: string;
}): Promise<PrevisualizacionPlantilla> {
  const { data } = await api.post<PrevisualizacionPlantilla>(
    `${RAIZ}/plantilla/previsualizar`,
    payload,
  );
  return data;
}

// ── Bitácora (§64) ──

/**
 * Lo que le ha pasado a una fila concreta.
 *
 * La cadena de un requerimiento NO se pide aquí: sale por
 * `/costos/requerimiento/:id/historial`, que ya existe y lleva el
 * control de acceso del requerimiento. Dos rutas para la misma pregunta
 * serían dos reglas de alcance esperando a discrepar.
 */
export async function auditoriaDeEntidad(
  entidad: EntidadCostos,
  entidadId: number,
): Promise<EventoCostos[]> {
  const { data } = await api.get<EventoCostos[]>(`${RAIZ}/auditoria`, {
    params: { entidad, entidadId },
  });
  return data;
}
