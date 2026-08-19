import { api } from '@/shared/services/api';
import type {
  CarpetaObra,
  ContenidoCarpeta,
  ProyectoDetalle,
  Jornada,
  EmpresaParticipante,
  Participacion,
  CalendarioPersona,
  PersonaElegible,
  EmpresaElegible,
  GuardarProyectoPayload,
  GuardarJornadaPayload,
} from '@/modules/personal/types';

const RAIZ = '/obra';

// ── Explorador ──

export async function navegar(carpetaId: number | null) {
  const { data } = await api.get<ContenidoCarpeta>(
    carpetaId === null ? `${RAIZ}/navegacion` : `${RAIZ}/navegacion/${carpetaId}`,
  );
  return data;
}

// ── Carpetas ──

export async function listarCarpetas() {
  const { data } = await api.get<CarpetaObra[]>(`${RAIZ}/carpeta`);
  return data;
}

export async function crearCarpeta(payload: {
  nombre: string;
  parentId: number | null;
}) {
  const { data } = await api.post<CarpetaObra>(`${RAIZ}/carpeta`, payload);
  return data;
}

export async function renombrarCarpeta(id: number, nombre: string) {
  const { data } = await api.patch<CarpetaObra>(`${RAIZ}/carpeta/${id}`, {
    nombre,
  });
  return data;
}

export async function eliminarCarpeta(id: number) {
  const { data } = await api.delete(`${RAIZ}/carpeta/${id}`);
  return data as { ok: true; nombre: string };
}

// ── Catálogos de personal ──
// Se piden con una FECHA: el backend resuelve el periodo que la cubre,
// no el más reciente.

export async function empresasPara(fecha: string) {
  const { data } = await api.get<{ empresas: EmpresaElegible[] }>(
    `${RAIZ}/personal/empresas`,
    { params: { fecha } },
  );
  return data.empresas;
}

export async function personasPara(
  fecha: string,
  tipo: 'supervisores' | 'contratistas',
  q?: string,
) {
  const { data } = await api.get<{ personas: PersonaElegible[] }>(
    `${RAIZ}/personal/${tipo}`,
    { params: { fecha, ...(q ? { q } : {}) } },
  );
  return data.personas;
}

// ── Proyectos ──

export async function crearProyecto(payload: GuardarProyectoPayload) {
  const { data } = await api.post<{ id: number }>(`${RAIZ}/proyecto`, payload);
  return data;
}

export async function obtenerProyecto(id: number) {
  const { data } = await api.get<ProyectoDetalle>(`${RAIZ}/proyecto/${id}`);
  return data;
}

export async function editarProyecto(
  id: number,
  cambios: Partial<GuardarProyectoPayload>,
) {
  const { data } = await api.patch(`${RAIZ}/proyecto/${id}`, cambios);
  return data;
}

export async function eliminarProyecto(id: number) {
  const { data } = await api.delete(`${RAIZ}/proyecto/${id}`);
  return data as { ok: true; nombre: string; jornadasEliminadas: number };
}

// ── Jornadas ──

export async function listarJornadas(proyectoId: number) {
  const { data } = await api.get<Jornada[]>(
    `${RAIZ}/proyecto/${proyectoId}/jornada`,
  );
  return data;
}

export async function guardarJornada(
  proyectoId: number,
  payload: GuardarJornadaPayload,
) {
  const { data } = await api.post(
    `${RAIZ}/proyecto/${proyectoId}/jornada`,
    payload,
  );
  return data;
}

export async function eliminarJornada(id: number) {
  const { data } = await api.delete(`${RAIZ}/jornada/${id}`);
  return data as { ok: true; fecha: string };
}

// ── Analítica ──

export async function empresasParticipantes(proyectoId: number) {
  const { data } = await api.get<EmpresaParticipante[]>(
    `${RAIZ}/proyecto/${proyectoId}/empresas`,
  );
  return data;
}

export async function participacion(proyectoId: number) {
  const { data } = await api.get<Participacion>(
    `${RAIZ}/proyecto/${proyectoId}/participacion`,
  );
  return data;
}

export async function calendarioDePersona(
  proyectoId: number,
  documento: string,
) {
  const { data } = await api.get<CalendarioPersona>(
    `${RAIZ}/proyecto/${proyectoId}/persona/${encodeURIComponent(documento)}`,
  );
  return data;
}
