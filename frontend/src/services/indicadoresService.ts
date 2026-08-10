import { api } from './api';
import type { IndicadoresPersonal, FiltrosPersonal } from '@/types/models';

/**
 * Trae las cuatro secciones del módulo Personal en una sola llamada:
 * KPIs, ranking, menor participación y utilización por empresa.
 */
export async function obtenerIndicadoresPersonal(
  filtros: FiltrosPersonal,
): Promise<IndicadoresPersonal> {
  const { data } = await api.get<IndicadoresPersonal>('/indicadores/personal', {
    params: {
      desde: filtros.desde,
      hasta: filtros.hasta,
      ...(filtros.empresaId !== null ? { empresaId: filtros.empresaId } : {}),
      ...(filtros.proyectoId !== null ? { proyectoId: filtros.proyectoId } : {}),
    },
  });
  return data;
}
