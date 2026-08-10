import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  obtenerIndicadoresMensual,
  obtenerEmpresaMensual,
  obtenerComparacionSupervisores,
  obtenerResumenSupervisor,
} from '@/services/mensualService';
import { QUERY_KEYS } from '@/lib/constants';
import type { RangoMeses, Periodo } from '@/types/models';

const OPCIONES = { placeholderData: keepPreviousData };

export interface FiltrosMensual extends RangoMeses {
  empresaId: number | null;
  proyectoId: number | null;
}

/** Indicadores de personal mes a mes. Solo se pide en modo "Meses". */
export function useIndicadoresMensual(
  filtros: FiltrosMensual,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: QUERY_KEYS.indicadoresMensual(filtros),
    queryFn: () => obtenerIndicadoresMensual(filtros),
    enabled: habilitado,
    ...OPCIONES,
  });
}

/** Detalle de una contratista. Solo consulta al desplegar su fila. */
export function useEmpresaMensual(
  empresaId: number,
  filtros: FiltrosMensual,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: QUERY_KEYS.empresaMensual(empresaId, filtros),
    queryFn: () => obtenerEmpresaMensual(empresaId, filtros),
    enabled: habilitado,
  });
}

/** Tabla comparativa de supervisores. */
export function useComparacionSupervisores(
  periodo: Periodo,
  habilitado = true,
) {
  return useQuery({
    queryKey: QUERY_KEYS.supervisoresComparacion(periodo),
    queryFn: () => obtenerComparacionSupervisores(periodo),
    enabled: habilitado,
    ...OPCIONES,
  });
}

/** Obras de un supervisor. Solo consulta al desplegar su fila. */
export function useResumenSupervisor(
  id: number,
  periodo: Periodo,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: QUERY_KEYS.supervisorResumen(id, periodo),
    queryFn: () => obtenerResumenSupervisor(id, periodo),
    enabled: habilitado,
  });
}
