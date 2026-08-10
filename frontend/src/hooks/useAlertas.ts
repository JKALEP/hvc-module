import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  obtenerAlertas,
  obtenerCruce,
  type FiltrosAlertas,
} from '@/services/alertasService';
import type { Periodo } from '@/types/models';

const OPCIONES = { placeholderData: keepPreviousData };

/**
 * Alertas activas. Solo se pide cuando la pestaña está abierta: es la
 * consulta más cara de /personal (recorre participaciones, reportes y
 * comparación de proyectos).
 */
export function useAlertas(filtros: FiltrosAlertas, habilitado: boolean) {
  return useQuery({
    queryKey: ['alertas', filtros],
    queryFn: () => obtenerAlertas(filtros),
    enabled: habilitado,
    ...OPCIONES,
  });
}

/** Cruce de una obra. Se consulta en el detalle del proyecto. */
export function useCruceProyecto(
  proyectoId: number | null,
  periodo: Periodo,
) {
  return useQuery({
    queryKey: ['alertas-cruce', proyectoId, periodo.desde, periodo.hasta],
    queryFn: () => obtenerCruce(proyectoId as number, periodo),
    enabled: proyectoId !== null,
    ...OPCIONES,
  });
}
