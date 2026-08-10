import { useQuery } from '@tanstack/react-query';
import { obtenerImportacion } from '@/services/importacionService';
import { QUERY_KEYS } from '@/lib/constants';

/** Detalle de una importación con sus filas. Se desactiva si el id no es válido. */
export function useImportacion(id: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.importacion(id ?? 0),
    queryFn: () => obtenerImportacion(id as number),
    enabled: typeof id === 'number' && !isNaN(id),
  });
}
