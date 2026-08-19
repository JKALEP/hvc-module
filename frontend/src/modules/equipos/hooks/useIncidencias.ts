import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  listarIncidencias,
  crearIncidencia,
  editarIncidencia,
  eliminarIncidencia,
  historialIncidencia,
} from '@/modules/equipos/services/equiposService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type {
  EstadoIncidencia,
  GuardarIncidenciaPayload,
} from '@/modules/equipos/types';

/**
 * Incidencias de una organización.
 *
 * Cualquier cambio invalida también el historial del EQUIPO: abrir o
 * cerrar una incidencia deja rastro en las dos bitácoras, porque la del
 * equipo es la que responde «¿qué le ha pasado a esta máquina?».
 */
function useInvalidar(organizacionId: number) {
  const qc = useQueryClient();
  return (incidenciaId?: number, equipoId?: number) => {
    void qc.invalidateQueries({ queryKey: ['incidencias', organizacionId] });
    if (incidenciaId !== undefined)
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.historialIncidencia(incidenciaId),
      });
    if (equipoId !== undefined) {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.equipo(equipoId) });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.historialEquipo(equipoId),
      });
    }
    void qc.invalidateQueries({ queryKey: ['inventario', organizacionId] });
  };
}

export function useIncidencias(
  organizacionId: number | null,
  filtros: { estado?: string; equipoId?: number | null; q?: string } = {},
) {
  return useQuery({
    queryKey: [
      'incidencias',
      organizacionId ?? 0,
      filtros.estado ?? '',
      filtros.equipoId ?? null,
      filtros.q ?? '',
    ],
    queryFn: () => listarIncidencias(organizacionId as number, filtros),
    enabled: organizacionId !== null,
  });
}

export function useHistorialIncidencia(id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.historialIncidencia(id ?? 0),
    queryFn: () => historialIncidencia(id as number),
    enabled: id !== null,
  });
}

export function useCrearIncidencia(organizacionId: number) {
  const invalidar = useInvalidar(organizacionId);
  return useMutation({
    mutationFn: (payload: GuardarIncidenciaPayload) => crearIncidencia(payload),
    onSuccess: (r) => {
      invalidar(r.id, r.equipoId);
      toast.success(`Incidencia ${r.codigo} abierta`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo abrir')),
  });
}

export function useEditarIncidencia(organizacionId: number) {
  const invalidar = useInvalidar(organizacionId);
  return useMutation({
    mutationFn: (vars: {
      id: number;
      equipoId: number;
      cambios: Partial<GuardarIncidenciaPayload> & {
        estado?: EstadoIncidencia;
      };
    }) => editarIncidencia(vars.id, vars.cambios),
    onSuccess: (_r, vars) => {
      invalidar(vars.id, vars.equipoId);
      toast.success('Incidencia actualizada');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo guardar')),
  });
}

export function useEliminarIncidencia(organizacionId: number) {
  const invalidar = useInvalidar(organizacionId);
  return useMutation({
    mutationFn: (vars: { id: number; equipoId: number }) =>
      eliminarIncidencia(vars.id),
    onSuccess: (r, vars) => {
      invalidar(vars.id, vars.equipoId);
      toast.success(`${r.codigo} eliminada`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}
