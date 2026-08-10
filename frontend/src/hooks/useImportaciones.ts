import { useQuery } from '@tanstack/react-query';
import { listarImportaciones } from '@/services/importacionService';
import { QUERY_KEYS } from '@/lib/constants';

/** Lista todas las importaciones. */
export function useImportaciones() {
  return useQuery({
    queryKey: QUERY_KEYS.importaciones,
    queryFn: listarImportaciones,
  });
}
