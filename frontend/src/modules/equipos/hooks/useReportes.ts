import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  resumenEquipos,
  dimensionesReporte,
  distribucionEquipos,
  exportarDistribucion,
  fichaEquipo,
  exportarFicha,
} from '@/modules/equipos/services/equiposService';
import { QUERY_KEYS } from '@/shared/lib/constants';

/**
 * Reportes: el resumen, la distribución y la ficha de un equipo.
 *
 * `organizacionId` en `null` no es «todavía no cargó» sino **todas**:
 * el consolidado global es un caso legítimo, así que las consultas van
 * habilitadas siempre y el `null` viaja en la clave de caché.
 */

export function useResumenEquipos(organizacionId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.resumenEquipos(organizacionId),
    queryFn: () => resumenEquipos(organizacionId),
  });
}

export function useDimensiones(organizacionId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.dimensionesReporte(organizacionId),
    queryFn: () => dimensionesReporte(organizacionId),
  });
}

export function useDistribucion(
  organizacionId: number | null,
  dimension: string,
) {
  return useQuery({
    queryKey: QUERY_KEYS.distribucion(organizacionId, dimension),
    queryFn: () => distribucionEquipos(organizacionId, dimension),
  });
}

export function useFichaEquipo(equipoId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.fichaEquipo(equipoId ?? 0),
    queryFn: () => fichaEquipo(equipoId as number),
    enabled: equipoId !== null,
  });
}

/** Genera y descarga. Nada queda guardado en el sistema. */
export function useExportarReporte() {
  return useMutation({
    mutationFn: (
      vars:
        | { tipo: 'ficha'; equipoId: number; formato: 'excel' | 'pdf' }
        | {
            tipo: 'distribucion';
            organizacionId: number | null;
            dimension: string;
            formato: 'excel' | 'pdf';
          },
    ) =>
      vars.tipo === 'ficha'
        ? exportarFicha(vars.equipoId, vars.formato)
        : exportarDistribucion(
            vars.organizacionId,
            vars.dimension,
            vars.formato,
          ),
    onSuccess: (nombre) => toast.success(`Descargado: ${nombre}`),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'No se pudo generar'),
  });
}
