import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listarReportes,
  obtenerReporte,
  crearReporte,
  editarReporte,
  eliminarReporte,
} from '@/services/reporteDiarioService';
import { getErrorMessage } from '@/services/api';
import { QUERY_KEYS } from '@/lib/constants';
import type { GuardarReportePayload, Periodo } from '@/types/models';

/** Lista de reportes diarios, opcionalmente filtrada por proyecto y rango. */
export function useReportesDiarios(
  proyectoId: number | null,
  periodo?: Periodo,
) {
  return useQuery({
    queryKey: QUERY_KEYS.reportesDiarios(proyectoId, periodo),
    queryFn: () => listarReportes(proyectoId, periodo),
  });
}

/**
 * Detalle de un reporte con sus participaciones.
 * Se usa en la bitácora del proyecto: solo consulta cuando la fila está
 * desplegada, para no traer el personal de todos los días de golpe.
 */
export function useReporteDiario(id: number, habilitado: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.reporteDiario(id),
    queryFn: () => obtenerReporte(id),
    enabled: habilitado,
  });
}

/**
 * Invalida todo lo que depende de los reportes diarios.
 *
 * La lista es lo obvio, pero desde que el AVANCE del proyecto se calcula
 * a partir de los reportes (Σ ejecutados / Σ programados), tocar una
 * jornada mueve también el resumen del proyecto, sus series, la
 * comparación entre obras, los indicadores de personal y las alertas.
 * Sin esto, el backend recalcula bien pero la pantalla sigue mostrando el
 * número viejo hasta recargar.
 */
function useInvalidadores() {
  const qc = useQueryClient();
  return (id?: number) => {
    for (const clave of [
      'reportes-diarios',
      'indicadores-personal',
      'indicadores-mensual',
      'empresa-mensual',
      'proyecto-resumen',
      'proyecto-cumplimiento',
      'proyecto-produccion',
      'proyecto-equipos',
      'proyecto-tecnicos',
      'proyecto-comparacion',
      'proyectos',
      'supervisores-comparacion',
      'supervisor-resumen',
      'alertas',
      'alertas-cruce',
    ]) {
      qc.invalidateQueries({ queryKey: [clave] });
    }
    if (id !== undefined) {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.reporteDiario(id) });
    }
  };
}

/** Crea un reporte diario con sus participaciones. */
export function useCrearReporte() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: (payload: GuardarReportePayload) => crearReporte(payload),
    onSuccess: (data) => {
      invalidar(data.id);
      toast.success(
        `Reporte guardado: ${data.proyecto.nombre} · ${data.tecnicosLaborando} técnico(s)`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo guardar el reporte')),
  });
}

interface EditarVars {
  id: number;
  payload: GuardarReportePayload;
}

/** Reescribe un reporte y regenera sus participaciones. */
export function useEditarReporte() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({ id, payload }: EditarVars) => editarReporte(id, payload),
    onSuccess: (data) => {
      invalidar(data.id);
      toast.success('Reporte actualizado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar el reporte')),
  });
}

/** Elimina un reporte. */
export function useEliminarReporte() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: (id: number) => eliminarReporte(id),
    onSuccess: (_data, id) => {
      invalidar(id);
      toast.success('Reporte eliminado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar el reporte')),
  });
}
