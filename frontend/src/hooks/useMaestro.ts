import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { buscarMaestro } from '@/services/maestroService';
import { QUERY_KEYS } from '@/lib/constants';

/** Busca en la tabla maestra. `q` ya debe venir con debounce aplicado. */
export function useMaestro(q: string) {
  return useQuery({
    queryKey: QUERY_KEYS.maestro(q),
    queryFn: () => buscarMaestro(q),
    placeholderData: keepPreviousData, // evita parpadeo mientras se teclea
  });
}
