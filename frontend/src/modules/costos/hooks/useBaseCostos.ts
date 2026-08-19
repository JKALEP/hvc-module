import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { buscarBaseCostos } from '@/modules/costos/services/costosService';
import { QUERY_KEYS } from '@/shared/lib/constants';

/**
 * El histórico de costos (§52). `q` ya debe venir con debounce aplicado.
 *
 * `keepPreviousData` evita el parpadeo al teclear y al cambiar de
 * página: la tabla anterior se queda en pantalla, atenuada, en vez de
 * vaciarse y volver a llenarse.
 */
export function useBaseCostos(q: string, pagina: number) {
  return useQuery({
    queryKey: QUERY_KEYS.baseCostos(q, pagina),
    queryFn: () => buscarBaseCostos(q, pagina),
    placeholderData: keepPreviousData,
  });
}
