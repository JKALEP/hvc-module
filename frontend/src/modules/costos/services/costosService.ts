import { api } from '@/shared/services/api';
import type {
  ClienteCostos,
  Costo,
  EventoCostos,
  GuardarItemPayload,
  GuardarRequerimientoPayload,
  ItemConEfectos,
  Observacion,
  OpcionesRequerimiento,
  PlantillaCosto,
  RegistrarCostoPayload,
  Requerimiento,
  RequerimientoItem,
  RespuestaBaseCostos,
  ResultadoBorrarItem,
} from '@/modules/costos/types';

// Módulo Costos: todas las llamadas al backend.
//
// Un solo archivo mientras quepa de un vistazo. Si crece, se parte por
// RECURSO —requerimiento, cotización, costo— y nunca por tipo técnico.

const RAIZ = '/costos';

// ── Selectores del formulario (§13) ──

/** Las cinco listas de una vez: es un formulario que se abre entero. */
export async function obtenerOpciones(): Promise<OpcionesRequerimiento> {
  const { data } = await api.get<OpcionesRequerimiento>(
    `${RAIZ}/requerimiento/opciones`,
  );
  return data;
}

// ── Requerimiento ──

export async function listarRequerimientos(
  grupo: 'pendientes' | 'finalizados' | 'todos',
): Promise<Requerimiento[]> {
  const { data } = await api.get<Requerimiento[]>(`${RAIZ}/requerimiento`, {
    params: grupo === 'todos' ? {} : { grupo },
  });
  return data;
}

export async function obtenerRequerimiento(
  id: number,
): Promise<Requerimiento> {
  const { data } = await api.get<Requerimiento>(`${RAIZ}/requerimiento/${id}`);
  return data;
}

/** Crea el borrador con la cabecera de §13. Todavía sin número. */
export async function crearRequerimiento(
  payload: GuardarRequerimientoPayload,
): Promise<Requerimiento> {
  const { data } = await api.post<Requerimiento>(
    `${RAIZ}/requerimiento`,
    payload,
  );
  return data;
}

export async function editarRequerimiento(
  id: number,
  payload: GuardarRequerimientoPayload,
): Promise<Requerimiento> {
  const { data } = await api.patch<Requerimiento>(
    `${RAIZ}/requerimiento/${id}`,
    payload,
  );
  return data;
}

/**
 * Reserva el número para enseñarlo en la vista previa.
 *
 * Idempotente en el backend: llamarlo dos veces devuelve el mismo número
 * y no consume otro correlativo, así que ir y volver al paso 3 es
 * gratis. Lo que NO es gratis es llegar al paso 3 y no emitir: eso deja
 * un hueco permanente en la serie.
 */
export async function reservarNumero(id: number): Promise<{ numero: string }> {
  const { data } = await api.post<{ numero: string }>(
    `${RAIZ}/requerimiento/${id}/reservar-numero`,
  );
  return data;
}

/**
 * Da de alta un cliente desde el propio formulario, sin salir a pedirle
 * el alta al SuperAdmin. Solo crea; editar y retirar siguen siendo suyos.
 */
export async function crearClienteDesdeRequerimiento(
  nombre: string,
): Promise<ClienteCostos> {
  const { data } = await api.post<ClienteCostos>(
    `${RAIZ}/requerimiento/cliente`,
    { nombre },
  );
  return data;
}

/** §25. También es «devolverlo corregido» tras una observación (§28). */
export async function emitirRequerimiento(
  id: number,
): Promise<Requerimiento> {
  const { data } = await api.post<Requerimiento>(
    `${RAIZ}/requerimiento/${id}/emitir`,
  );
  return data;
}

export async function cancelarRequerimiento(
  id: number,
  motivo: string,
): Promise<Requerimiento> {
  const { data } = await api.post<Requerimiento>(
    `${RAIZ}/requerimiento/${id}/cancelar`,
    { motivo },
  );
  return data;
}

/** El «Cancelar» de §15: abandona un borrador que nadie ha visto. */
export async function borrarBorrador(id: number): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `${RAIZ}/requerimiento/${id}`,
  );
  return data;
}

// ── Ítems (§19-23) ──

export async function agregarItem(
  requerimientoId: number,
  payload: GuardarItemPayload,
): Promise<RequerimientoItem> {
  const { data } = await api.post<RequerimientoItem>(
    `${RAIZ}/requerimiento/${requerimientoId}/item`,
    payload,
  );
  return data;
}

/** La respuesta trae `efectos`: qué cotizaciones invalidó el cambio (§54). */
export async function editarItem(
  requerimientoId: number,
  itemId: number,
  payload: GuardarItemPayload,
): Promise<ItemConEfectos> {
  const { data } = await api.patch<ItemConEfectos>(
    `${RAIZ}/requerimiento/${requerimientoId}/item/${itemId}`,
    payload,
  );
  return data;
}

export async function borrarItem(
  requerimientoId: number,
  itemId: number,
): Promise<ResultadoBorrarItem> {
  const { data } = await api.delete<ResultadoBorrarItem>(
    `${RAIZ}/requerimiento/${requerimientoId}/item/${itemId}`,
  );
  return data;
}

// ── Observaciones (§27-29) ──

export async function listarObservaciones(
  requerimientoId: number,
): Promise<Observacion[]> {
  const { data } = await api.get<Observacion[]>(
    `${RAIZ}/requerimiento/${requerimientoId}/observacion`,
  );
  return data;
}

/**
 * El Gestor pide corregir algo (§27).
 *
 * Una observación por cada cosa que falta, no un texto que se
 * reescribe: §44 admite varias vueltas y §53 prohíbe perder lo
 * anterior. Devuelve el requerimiento a OBSERVADO.
 */
export async function crearObservacion(
  requerimientoId: number,
  texto: string,
): Promise<Observacion> {
  const { data } = await api.post<Observacion>(
    `${RAIZ}/requerimiento/${requerimientoId}/observacion`,
    { texto },
  );
  return data;
}

/** §29. Sin esto, emitir desde OBSERVADO se rechaza. */
export async function confirmarObservacion(
  observacionId: number,
  respuesta: string,
): Promise<Observacion> {
  const { data } = await api.post<Observacion>(
    `${RAIZ}/observacion/${observacionId}/confirmar`,
    { respuesta },
  );
  return data;
}

// ── Costo (§47-52) ──

export async function obtenerPlantillaCosto(
  requerimientoId: number,
): Promise<PlantillaCosto> {
  const { data } = await api.get<PlantillaCosto>(
    `${RAIZ}/requerimiento/${requerimientoId}/costo/plantilla`,
  );
  return data;
}

export async function obtenerCosto(requerimientoId: number): Promise<Costo> {
  const { data } = await api.get<Costo>(
    `${RAIZ}/requerimiento/${requerimientoId}/costo`,
  );
  return data;
}

/** §51. Cierra el requerimiento: pasa a FINALIZADO. */
export async function registrarCosto(
  requerimientoId: number,
  payload: RegistrarCostoPayload,
): Promise<Costo> {
  const { data } = await api.post<Costo>(
    `${RAIZ}/requerimiento/${requerimientoId}/costo`,
    payload,
  );
  return data;
}

export async function corregirCosto(
  requerimientoId: number,
  payload: RegistrarCostoPayload,
): Promise<Costo> {
  const { data } = await api.patch<Costo>(
    `${RAIZ}/requerimiento/${requerimientoId}/costo`,
    payload,
  );
  return data;
}

// ── Auditoría (§64) ──

export async function obtenerHistorial(
  requerimientoId: number,
): Promise<EventoCostos[]> {
  const { data } = await api.get<EventoCostos[]>(
    `${RAIZ}/requerimiento/${requerimientoId}/historial`,
  );
  return data;
}

// ── Base de Costos (§52) ──

export async function buscarBaseCostos(
  q: string,
  pagina: number,
): Promise<RespuestaBaseCostos> {
  const { data } = await api.get<RespuestaBaseCostos>(`${RAIZ}/base`, {
    params: { ...(q ? { q } : {}), pagina },
  });
  return data;
}
