import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  obtenerResumen,
  obtenerProduccionDiaria,
  obtenerEquipos,
  obtenerTecnicos,
  obtenerCumplimientoAcumulado,
  obtenerAjustes,
  registrarAjuste,
  eliminarAjuste,
  obtenerComparacion,
} from '@/services/proyectoService';
import { getErrorMessage } from '@/services/api';
import { QUERY_KEYS } from '@/lib/constants';
import type { Periodo, GuardarAjustePayload } from '@/types/models';

// Al cambiar el rango se mantienen los datos anteriores en pantalla para
// que los gráficos no parpadeen a vacío en cada ajuste del filtro.
const OPCIONES_SERIE = { placeholderData: keepPreviousData };

/** Tarjeta ejecutiva de un proyecto. */
export function useResumenProyecto(id: number | null, periodo: Periodo) {
  return useQuery({
    queryKey: QUERY_KEYS.resumenProyecto(id ?? 0, periodo),
    queryFn: () => obtenerResumen(id as number, periodo),
    enabled: id !== null,
    ...OPCIONES_SERIE,
  });
}

/** Serie de producción diaria. */
export function useProduccionDiaria(id: number | null, periodo: Periodo) {
  return useQuery({
    queryKey: QUERY_KEYS.produccionDiaria(id ?? 0, periodo),
    queryFn: () => obtenerProduccionDiaria(id as number, periodo),
    enabled: id !== null,
    ...OPCIONES_SERIE,
  });
}

/** Serie de equipos programados vs ejecutados. */
export function useEquiposProyecto(id: number | null, periodo: Periodo) {
  return useQuery({
    queryKey: QUERY_KEYS.equiposProyecto(id ?? 0, periodo),
    queryFn: () => obtenerEquipos(id as number, periodo),
    enabled: id !== null,
    ...OPCIONES_SERIE,
  });
}

/** Serie de técnicos programados vs laborando. */
export function useTecnicosProyecto(id: number | null, periodo: Periodo) {
  return useQuery({
    queryKey: QUERY_KEYS.tecnicosProyecto(id ?? 0, periodo),
    queryFn: () => obtenerTecnicos(id as number, periodo),
    enabled: id !== null,
    ...OPCIONES_SERIE,
  });
}

/** Serie del cumplimiento acumulado día a día + ajustes manuales. */
export function useCumplimientoAcumulado(id: number | null, periodo: Periodo) {
  return useQuery({
    queryKey: QUERY_KEYS.cumplimientoAcumulado(id ?? 0, periodo),
    queryFn: () => obtenerCumplimientoAcumulado(id as number, periodo),
    enabled: id !== null,
    ...OPCIONES_SERIE,
  });
}

/** Historial de ajustes manuales. No depende del período. */
export function useAjustes(id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.ajustesAvance(id ?? 0),
    queryFn: () => obtenerAjustes(id as number),
    enabled: id !== null,
  });
}

/** Comparación entre todos los proyectos. */
export function useComparacionProyectos(periodo: Periodo) {
  return useQuery({
    queryKey: QUERY_KEYS.comparacionProyectos(periodo),
    queryFn: () => obtenerComparacion(periodo),
    ...OPCIONES_SERIE,
  });
}

/**
 * Invalida lo que depende del avance semanal: su propio historial, el
 * resumen del proyecto (muestra el acumulado) y la comparación.
 */
function useInvalidarAvance(id: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.ajustesAvance(id) });
    qc.invalidateQueries({ queryKey: ['proyecto-cumplimiento', id] });
    qc.invalidateQueries({ queryKey: ['proyecto-resumen', id] });
    qc.invalidateQueries({ queryKey: ['proyecto-comparacion'] });
    qc.invalidateQueries({ queryKey: ['proyectos'] });
  };
}

/** Registra un ajuste manual del avance calculado. */
export function useRegistrarAjuste(id: number) {
  const invalidar = useInvalidarAvance(id);
  return useMutation({
    mutationFn: (payload: GuardarAjustePayload) => registrarAjuste(id, payload),
    onSuccess: (data) => {
      invalidar();
      toast.success(`Ajuste registrado: ${Number(data.porcentaje)}%`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo registrar el ajuste')),
  });
}

/** Elimina un ajuste manual. */
export function useEliminarAjuste(id: number) {
  const invalidar = useInvalidarAvance(id);
  return useMutation({
    mutationFn: (ajusteId: number) => eliminarAjuste(id, ajusteId),
    onSuccess: () => {
      invalidar();
      toast.success('Ajuste eliminado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar el ajuste')),
  });
}
