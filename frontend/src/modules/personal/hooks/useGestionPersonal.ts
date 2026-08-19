import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  listarPeriodos,
  obtenerPeriodo,
  crearPeriodo,
  copiarPeriodo,
  eliminarPeriodo,
  crearGrupo,
  editarGrupo,
  eliminarGrupo,
  obtenerCatalogo,
  crearOpcion,
} from '@/modules/personal/services/gestionPersonalService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { TipoPersonal, CampoPersonal } from '@/modules/personal/types';

/**
 * Periodos, grupos y catálogo de la gestión de personal.
 *
 * Las fichas van aparte (`useFichas`) porque se editan celda a celda y
 * su invalidación es mucho más frecuente.
 */

/** Todo lo que depende del periodo abierto. */
export function useInvalidarPeriodo(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({
      queryKey: QUERY_KEYS.periodoPersonal(anio, mes, tipo),
    });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.periodosPersonal(tipo) });
  };
}

/** Los periodos que ya existen de un tipo, para el selector. */
export function usePeriodos(tipo: TipoPersonal) {
  return useQuery({
    queryKey: QUERY_KEYS.periodosPersonal(tipo),
    queryFn: () => listarPeriodos(tipo),
  });
}

/**
 * El periodo abierto, con sus grupos y su gente.
 *
 * Devuelve `{ existe: false }` cuando el mes aún no está creado; no es
 * un error, es el estado normal al abrir un mes nuevo.
 */
export function usePeriodo(anio: number, mes: number, tipo: TipoPersonal) {
  return useQuery({
    queryKey: QUERY_KEYS.periodoPersonal(anio, mes, tipo),
    queryFn: () => obtenerPeriodo(anio, mes, tipo),
  });
}

export function useCrearPeriodo(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: () => crearPeriodo({ anio, mes, tipo }),
    onSuccess: () => {
      invalidar();
      toast.success('Periodo creado');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo crear el periodo')),
  });
}

export function useCopiarPeriodo(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (desdePeriodoId?: number) =>
      copiarPeriodo({ anio, mes, tipo, desdePeriodoId }),
    onSuccess: () => {
      invalidar();
      toast.success('Periodo copiado del mes anterior');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo copiar el periodo')),
  });
}

export function useEliminarPeriodo(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (id: number) => eliminarPeriodo(id),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        `Periodo eliminado · ${r.personasEliminadas} persona(s) borradas`,
      );
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo eliminar el periodo')),
  });
}

// ── Grupos ──

export function useCrearGrupo(anio: number, mes: number, tipo: TipoPersonal) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (vars: { periodoId: number; nombre: string }) =>
      crearGrupo(vars),
    onSuccess: () => {
      invalidar();
      toast.success('Grupo creado');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo crear el grupo')),
  });
}

export function useEditarGrupo(anio: number, mes: number, tipo: TipoPersonal) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (vars: { id: number; nombre: string }) =>
      editarGrupo(vars.id, vars.nombre),
    onSuccess: () => {
      invalidar();
      toast.success('Grupo renombrado');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo renombrar el grupo')),
  });
}

export function useEliminarGrupo(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (id: number) => eliminarGrupo(id),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        r.personasEliminadas > 0
          ? `"${r.nombre}" eliminado con ${r.personasEliminadas} persona(s)`
          : `"${r.nombre}" eliminado`,
      );
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo eliminar el grupo')),
  });
}

// ── Catálogo ──

/** Lo que ofrecen los siete selectores de la tabla. */
export function useCatalogo() {
  return useQuery({
    queryKey: QUERY_KEYS.catalogoPersonal,
    queryFn: obtenerCatalogo,
    // Cambia poco y lo consultan todas las celdas de la tabla.
    staleTime: 5 * 60 * 1000,
  });
}

export function useCrearOpcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { campo: CampoPersonal; valor: string }) =>
      crearOpcion(vars.campo, vars.valor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.catalogoPersonal });
      toast.success('Opción añadida');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo añadir la opción')),
  });
}
