import { useQuery } from '@tanstack/react-query';

import { auditoriaDeEntidad } from '@/modules/costos/services/adminService';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { EntidadCostos } from '@/modules/costos/types';

/**
 * La bitácora por FILA (§64).
 *
 * La otra mitad —la cadena completa de un requerimiento— ya la sirve
 * `useHistorial` en `useRequerimientos`, y se queda ahí: cuelga del
 * requerimiento y lleva su mismo control de acceso. Aquí solo está lo
 * que no tenía sitio: qué le ha pasado a un proveedor, a una opción de
 * catálogo o a una cotización, que pueden no pertenecer a ningún
 * requerimiento.
 */
export function useAuditoriaEntidad(
  entidad: EntidadCostos,
  entidadId: number | undefined,
  activo: boolean,
) {
  return useQuery({
    queryKey: QUERY_KEYS.auditoriaEntidad(entidad, entidadId ?? 0),
    queryFn: () => auditoriaDeEntidad(entidad, entidadId as number),
    enabled:
      activo && typeof entidadId === 'number' && !Number.isNaN(entidadId),
  });
}
