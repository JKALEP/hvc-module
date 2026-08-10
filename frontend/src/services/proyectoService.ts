import { api } from './api';
import type {
  Proyecto,
  ResumenProyecto,
  PuntoProduccion,
  PuntoEquipos,
  PuntoTecnicos,
  FilaComparacion,
  AjusteAvance,
  GuardarAjustePayload,
  SerieCumplimiento,
  Periodo,
} from '@/types/models';

// Todas las llamadas al módulo /proyecto del backend.

/** Parámetros de rango. Se omiten los vacíos para no mandar querystring inútil. */
function params(periodo?: Periodo) {
  if (!periodo) return {};
  return {
    ...(periodo.desde ? { desde: periodo.desde } : {}),
    ...(periodo.hasta ? { hasta: periodo.hasta } : {}),
  };
}

/** Lista proyectos con su último avance vigente. */
export async function listarProyectos(): Promise<Proyecto[]> {
  const { data } = await api.get<Proyecto[]>('/proyecto');
  return data;
}

/** Crea un proyecto. `cliente` y `ubicacion` pueden completarse después. */
export async function crearProyecto(payload: {
  nombre: string;
  cliente?: string | null;
  ubicacion?: string | null;
}): Promise<Proyecto> {
  const { data } = await api.post<Proyecto>('/proyecto', payload);
  return data;
}

/**
 * Tarjeta ejecutiva. El avance acumulado que devuelve NO depende del
 * período: es Sigma ejecutados / Sigma programados de todo el historial.
 */
export async function obtenerResumen(
  id: number,
  periodo: Periodo,
): Promise<ResumenProyecto> {
  const { data } = await api.get<ResumenProyecto>(`/proyecto/${id}/resumen`, {
    params: params(periodo),
  });
  return data;
}

/** Serie diaria de producción para el gráfico de línea. */
export async function obtenerProduccionDiaria(
  id: number,
  periodo: Periodo,
): Promise<PuntoProduccion[]> {
  const { data } = await api.get<PuntoProduccion[]>(
    `/proyecto/${id}/produccion-diaria`,
    { params: params(periodo) },
  );
  return data;
}

/** Equipos programados vs ejecutados. */
export async function obtenerEquipos(
  id: number,
  periodo: Periodo,
): Promise<PuntoEquipos[]> {
  const { data } = await api.get<PuntoEquipos[]>(`/proyecto/${id}/equipos`, {
    params: params(periodo),
  });
  return data;
}

/** Técnicos programados vs laborando. */
export async function obtenerTecnicos(
  id: number,
  periodo: Periodo,
): Promise<PuntoTecnicos[]> {
  const { data } = await api.get<PuntoTecnicos[]>(`/proyecto/${id}/tecnicos`, {
    params: params(periodo),
  });
  return data;
}

/** Serie del cumplimiento acumulado día a día + los ajustes manuales. */
export async function obtenerCumplimientoAcumulado(
  id: number,
  periodo: Periodo,
): Promise<SerieCumplimiento> {
  const { data } = await api.get<SerieCumplimiento>(
    `/proyecto/${id}/cumplimiento-acumulado`,
    { params: params(periodo) },
  );
  return data;
}

/** Historial de ajustes manuales del proyecto. */
export async function obtenerAjustes(id: number): Promise<AjusteAvance[]> {
  const { data } = await api.get<AjusteAvance[]>(
    `/proyecto/${id}/ajuste-avance`,
  );
  return data;
}

/**
 * Registra un ajuste manual del avance. Es un EVENTO, no un valor que se
 * sobrescribe: la justificación es obligatoria y el backend la exige.
 */
export async function registrarAjuste(
  id: number,
  payload: GuardarAjustePayload,
): Promise<AjusteAvance> {
  const { data } = await api.post<AjusteAvance>(
    `/proyecto/${id}/ajuste-avance`,
    payload,
  );
  return data;
}

/** Elimina un ajuste manual. */
export async function eliminarAjuste(
  id: number,
  ajusteId: number,
): Promise<{ ok: boolean; id: number }> {
  const { data } = await api.delete(`/proyecto/${id}/ajuste-avance/${ajusteId}`);
  return data;
}

/** Comparación entre todos los proyectos sobre el mismo período. */
export async function obtenerComparacion(
  periodo: Periodo,
): Promise<FilaComparacion[]> {
  const { data } = await api.get<FilaComparacion[]>('/proyecto/comparacion', {
    params: params(periodo),
  });
  return data;
}
