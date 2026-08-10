import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { obtenerIndicadoresPersonal } from '@/services/indicadoresService';
import { QUERY_KEYS } from '@/lib/constants';
import type { FiltrosPersonal } from '@/types/models';

/**
 * Indicadores del módulo Personal. Al cambiar un filtro se mantienen los
 * datos anteriores en pantalla mientras llega la nueva respuesta, para que
 * los KPIs no salten a vacío en cada cambio.
 */
export function useIndicadoresPersonal(filtros: FiltrosPersonal) {
  return useQuery({
    queryKey: QUERY_KEYS.indicadoresPersonal(filtros),
    queryFn: () => obtenerIndicadoresPersonal(filtros),
    placeholderData: keepPreviousData,
  });
}
