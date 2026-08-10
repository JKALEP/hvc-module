import { api } from './api';
import type {
  ReporteDiario,
  ReporteDiarioDetalle,
  GuardarReportePayload,
  Periodo,
} from '@/types/models';

// Llamadas al módulo /reporte-diario del backend.

/** Lista reportes, opcionalmente filtrados por proyecto y por rango. */
export async function listarReportes(
  proyectoId: number | null,
  periodo?: Periodo,
): Promise<ReporteDiario[]> {
  const { data } = await api.get<ReporteDiario[]>('/reporte-diario', {
    params: {
      ...(proyectoId !== null ? { proyectoId } : {}),
      ...(periodo?.desde ? { desde: periodo.desde } : {}),
      ...(periodo?.hasta ? { hasta: periodo.hasta } : {}),
    },
  });
  return data;
}

/** Detalle de un reporte con sus participaciones. */
export async function obtenerReporte(
  id: number,
): Promise<ReporteDiarioDetalle> {
  const { data } = await api.get<ReporteDiarioDetalle>(`/reporte-diario/${id}`);
  return data;
}

/** Crea el reporte y sus participaciones en una sola transacción. */
export async function crearReporte(
  payload: GuardarReportePayload,
): Promise<ReporteDiarioDetalle> {
  const { data } = await api.post<ReporteDiarioDetalle>(
    '/reporte-diario',
    payload,
  );
  return data;
}

/** Reescribe el reporte y regenera sus participaciones. */
export async function editarReporte(
  id: number,
  payload: GuardarReportePayload,
): Promise<ReporteDiarioDetalle> {
  const { data } = await api.put<ReporteDiarioDetalle>(
    `/reporte-diario/${id}`,
    payload,
  );
  return data;
}

/** Elimina un reporte (sus participaciones caen en cascada). */
export async function eliminarReporte(
  id: number,
): Promise<{ ok: boolean; id: number }> {
  const { data } = await api.delete(`/reporte-diario/${id}`);
  return data;
}
