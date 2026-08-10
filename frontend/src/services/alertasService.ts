import { api } from './api';
import type { RespuestaAlertas, CruceProyecto, Periodo } from '@/types/models';

// Llamadas al módulo /alertas del backend.

export interface FiltrosAlertas extends Periodo {
  proyectoId: number | null;
  empresaId: number | null;
}

/** Alertas activas del período, ya ordenadas por severidad. */
export async function obtenerAlertas(
  filtros: FiltrosAlertas,
): Promise<RespuestaAlertas> {
  const { data } = await api.get<RespuestaAlertas>('/alertas', {
    params: {
      ...(filtros.desde ? { desde: filtros.desde } : {}),
      ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
      ...(filtros.proyectoId !== null ? { proyectoId: filtros.proyectoId } : {}),
      ...(filtros.empresaId !== null ? { empresaId: filtros.empresaId } : {}),
    },
  });
  return data;
}

/** Cruce Proyecto → Personal → Empresa → Utilización, de una obra. */
export async function obtenerCruce(
  proyectoId: number,
  periodo: Periodo,
): Promise<CruceProyecto> {
  const { data } = await api.get<CruceProyecto>('/alertas/cruce', {
    params: {
      proyectoId,
      ...(periodo.desde ? { desde: periodo.desde } : {}),
      ...(periodo.hasta ? { hasta: periodo.hasta } : {}),
    },
  });
  return data;
}
